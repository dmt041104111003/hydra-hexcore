import { JwtService } from '@nestjs/jwt';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtHelper } from 'src/auth/jwt.helper';
import { JwtPayload } from './interfaces/jwtPayload.type';
import { jwtConstants } from 'src/constants';
import { HydraGameService } from './hydra-game.service';
import { GameUser } from './entities/User.entity';

enum SocketEvent {
    JOIN_ROOM = 'join_room',
    LEAVE_ROOM = 'leave_room',
    TYPING = 'typing',
    STOP_TYPING = 'stop_typing',
    MESSAGE = 'message',
    CONNECTED = 'connected',
}

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: 'hydra-game',
    transports: ['websocket', 'polling'],
})
export class EventGateway implements OnGatewayConnection, OnGatewayDisconnect {
    protected userIdMap = new Map<number, string>();
    constructor(
        private jwtService: JwtService,
        private hydraGameService: HydraGameService,
    ) {}

    @WebSocketServer()
    server: Server;

    async handleConnection(@ConnectedSocket() client: Socket, ...args: any[]): Promise<any> {
        try {
            console.log('[Client connected]', client.id);
            const token = JwtHelper.extractTokenFromHeader(client.handshake.headers);
            if (!token) {
                client.disconnect();
            }
            try {
                const jwtPayload = await this.jwtService.verifyAsync<JwtPayload>(token, {
                    secret: jwtConstants.secret,
                });
                const userId = jwtPayload.id;
                if (this.userIdMap.has(userId)) {
                    // User already connected, disconnect old connection
                    const clientId = this.userIdMap.get(userId);
                    console.error(`[Websocket]: User ${userId} already connected at`, clientId);
                    // @ts-ignore
                    const oldClient = this.server.sockets.get(clientId);
                    oldClient.emit(
                        SocketEvent.MESSAGE,
                        'You have been disconnected because you logged in from another device',
                    );
                    oldClient.disconnect();
                }
                this.userIdMap.set(userId, client.id);
                const unicastRoom = this.joinRoomUnicast(userId, client);
                client.emit(SocketEvent.CONNECTED, { unicastRoom });
            } catch (error) {
                console.error('[Websocket]: error ', error);
                client.disconnect();
            }
        } catch (error) {
            console.error('Connection error: ', error);
        }
    }

    async handleDisconnect(client: Socket): Promise<void> {
        const user = await this.getUserFromSocket(client);
        if (!user) {
            console.error('[Client disconnected]', 'User not found', client.id);
            return;
        }
        await this.hydraGameService.removeUserInRoom(user);
        this.userIdMap.delete(user.id);
        console.log('[Client disconnected]', `[User ID: ${user.id}]`, client.id);
    }

    async getUserFromSocket(client: Socket): Promise<GameUser | null> {
        let userId: number | null = null;
        this.userIdMap.forEach((value, key) => {
            if (value === client.id) {
                userId = key;
            }
        });
        if (userId === null) {
            return null;
        }
        const user = await this.hydraGameService.getUser(userId);
        return user || null;
    }

    joinRoomUnicast(userId: number, @ConnectedSocket() client: Socket) {
        console.log('[Auth client connected]', client.id);
        const roomName = this.getUnicastRoomName(userId);
        client.join(roomName);
        return roomName;
    }

    getUnicastRoomName(userId: number): `unicast_room_${number}` {
        return `unicast_room_${userId}`;
    }

    emitMulticast<T>(rooms: ReturnType<typeof this.getUnicastRoomName>[], event: SocketEvent, data: T) {
        this.server.to(rooms).emit(event, data);
    }

    @SubscribeMessage(SocketEvent.JOIN_ROOM)
    async handleJoinRoomGame(
        @MessageBody() msgBody: { roomId?: number; port?: number },
        @ConnectedSocket() client: Socket,
    ) {
        const { roomId, port } = msgBody;
        if (!roomId || !port) {
            return client.emit(SocketEvent.JOIN_ROOM, { status: 'error', message: 'Invalid payload' });
        }

        const user = await this.getUserFromSocket(client);
        try {
            const rs = await this.hydraGameService.addUserIntoRoom(roomId, user, port);
            return client.emit(SocketEvent.JOIN_ROOM, {
                status: 'success',
                data: {
                    room: {
                        id: rs.room.id,
                        name: rs.room.name,
                    },
                    port: rs.port,
                    party: {
                        nodes: rs.room.party.nodes,
                    },
                },
            });
        } catch (error) {
            return client.emit(SocketEvent.JOIN_ROOM, {
                status: 'error',
                message: error?.message,
            });
        }
    }

    @SubscribeMessage(SocketEvent.LEAVE_ROOM)
    async handleLeaveRoomGame(@MessageBody() msgBody: { roomId?: number }, @ConnectedSocket() client: Socket) {
        if (!msgBody.roomId) {
            return client.emit(SocketEvent.MESSAGE, { data: null, message: `Require roomId` });
        }

        const user = await this.getUserFromSocket(client);
        if (!user) {
            return client.emit(SocketEvent.MESSAGE, 'Not recognize user');
        }
        const rs = await this.hydraGameService.removeUserInRoom(user);
        return client.emit(SocketEvent.MESSAGE, { data: rs, message: `Leave room ${msgBody.roomId}` });
    }
}
