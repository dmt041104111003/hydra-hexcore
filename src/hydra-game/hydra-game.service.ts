import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Docker from 'dockerode';
import bcrypt from 'bcryptjs';

import { HydraParty } from '../hydra-main/entities/HydraParty.entity';
import { HydraNode } from '../hydra-main/entities/HydraNode.entity';
import { GameUser } from './entities/User.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { GameRoom } from './entities/Room.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { GameRoomDetail } from './entities/RoomDetail.entity';
import { CreateRoomDetailDto } from './dto/create-room-detail.dto';
import { JwtService } from '@nestjs/jwt';
import { UserLoginDto } from './dto/user-login.dto';
import { JwtPayload } from './interfaces/jwtPayload.type';
import { ResUserInfoDto } from './dto/response/user-info.dto';

@Injectable()
export class HydraGameService implements OnModuleInit {
    private docker: Docker;

    constructor(
        @InjectRepository(HydraParty)
        private hydraPartyRepository: Repository<HydraParty>,
        @InjectRepository(HydraNode)
        private hydraNodeRepository: Repository<HydraNode>,
        @InjectRepository(GameUser)
        private gameUserRepository: Repository<GameUser>,
        @InjectRepository(GameRoom)
        private gameRoomRepository: Repository<GameRoom>,
        @InjectRepository(GameRoomDetail)
        private gameRoomDetailRepository: Repository<GameRoomDetail>,
        private jwtService: JwtService,
    ) {
        const DOCKER_SOCKET = process.env.NEST_DOCKER_SOCKET_PATH || '\\\\.\\pipe\\docker_engine';
        this.docker = new Docker({ socketPath: DOCKER_SOCKET });
    }

    async onModuleInit() { }

    // ******** GAME RO0M **********
    async createRoom(body: CreateRoomDto) {
        if (body.name.length === 0) {
            throw new BadRequestException('Room Name cannot be empty');
        }
        else {
            const gameRoom = await this.gameRoomRepository.findOne({
                where: { name: body.name },
            });
            if (gameRoom) {
                throw new BadRequestException('Room Name already exists');
            }
        }

        const hydraParty = await this.hydraPartyRepository.findOne({
            where: { id: body.partyId },
        });
        if (!hydraParty) {
            throw new BadRequestException('Invalid Hydra Party');
        }

        const room = this.gameRoomRepository.create({
            party: hydraParty,
            name: body.name
        });
        return this.gameRoomRepository.save(room);
    }

    async getListRoom(query: any): Promise<GameRoom[]> {
        // Get node container
        // const containers = await this.docker.listContainers({
        //     all: false,
        //     filters: {
        //         name: ['hexcore-hydra-node-'],
        //         status: ['running'],
        //         // label: ['party_name=party-1']
        //     },
        // });

        // const partyRuningIds = Array.from(
        //     new Set(containers.map((containerInfo) => parseInt(containerInfo.Labels.party_id))),
        // );
        // const queryBuilder = this.hydraPartyRepository
        //     .createQueryBuilder('party')
        //     .where('party.id IN (:...ids)', { ids: partyRuningIds })
        //     .leftJoinAndSelect('party.hydraNodes', 'hydraNodes')
        //     .leftJoinAndSelect('hydraNodes.cardanoAccount', 'cardanoAccount');

        // console.log(queryBuilder.getSql());

        // const parties = await queryBuilder.getMany();
        // return parties;

        const { status, page = 1, limit = 10 } = query;
        const queryBuilder = await this.gameRoomRepository
            .createQueryBuilder('room')
            .leftJoinAndSelect('room.party', 'party')
            .leftJoinAndSelect('party.hydraNodes', 'hydraNodes')
            .leftJoinAndSelect('room.gameRoomDetails', 'gameRoomDetails')

        if (status) {
            queryBuilder.andWhere('room.status = :status', { status });
        }

        queryBuilder.skip((page - 1) * limit).take(limit);

        const rooms = await queryBuilder.getMany();
        return rooms;
    }

    async getRoom(id: number): Promise<GameRoom> {
        const room = await this.gameRoomRepository.findOne({
            where: { id },
            relations: ['party', 'party.hydraNodes', 'gameRoomDetails'],
        });

        return room
    }

    async getPortRoom(id: number) {
        const room = await this.gameRoomRepository.findOne({
            where: { id },
            relations: ['party', 'party.hydraNodes', 'gameRoomDetails'],
        });
        if (room.status === "INACTIVE") {
            throw new BadRequestException('Room is INACTIVE');
        }

        if (room.gameRoomDetails.length == room.party.nodes) {
            throw new BadRequestException('You can not join the room because it is full.');
        }

        const gameRoomDetailPorts = room.gameRoomDetails.map(detail => detail.port);
        const filteredHydraPorts = room.party.hydraNodes
            .map(node => node.port)
            .filter(port => !gameRoomDetailPorts.includes(port));

        console.log(filteredHydraPorts);


        return filteredHydraPorts
    }


    // ******** GAME RO0M DETAIL **********
    async createRoomDetail(body: CreateRoomDetailDto) {
        const user = await this.gameUserRepository.findOne({
            where: { id: body.userId },
        });
        if (!user) {
            throw new BadRequestException('Invalid User');
        }
        else {
            const gameRoomDetail = await this.gameRoomDetailRepository.findOne({
                where: { user: user },
            });
            if (gameRoomDetail) {
                throw new BadRequestException('User already exists');
            }
        }

        const gameRoom = await this.gameRoomRepository.findOne({
            where: { id: body.roomId },
        });
        if (!gameRoom) {
            throw new BadRequestException('Invalid Room');
        }
        else {
            const hydraNode = await this.hydraNodeRepository.findOne({
                where: { party: gameRoom.party, port: body.port },
            });
            if (!hydraNode) {
                throw new BadRequestException('Invalid Port');
            }
        }

        const roomDetail = this.gameRoomDetailRepository.create({
            port: body.port,
            room: gameRoom,
            user: user
        });
        return this.gameRoomDetailRepository.save(roomDetail);
    }

    async deleteRoomDetail(id: GameRoomDetail['id']): Promise<Record<string, any>> {
        const deletedRoomDetail = await this.gameRoomDetailRepository.delete({ id });
        if (!deletedRoomDetail) {
            throw new NotFoundException();
        }
        return {
            id,
            data: deletedRoomDetail.raw,
            message: 'Room detail deleted successfully',
        };
    }

    // ******** GAME USER **********
    async createUser(createUserDto: CreateUserDto) {
        const existed = await this.gameUserRepository.findOne({
            where: { address: createUserDto.address },
        });
        if (existed) {
            throw new BadRequestException('User already existed');
        }
        const saltRounds = 10;
        const password = createUserDto.password;
        const passwordHashed = await bcrypt.hash(password, saltRounds);
        const user = this.gameUserRepository.create({
            address: createUserDto.address,
            password: passwordHashed,
        });
        return this.gameUserRepository.save(user);
    }

    async signIn({ address, password }: UserLoginDto): Promise<{ accessToken: string }> {
        const user = await this.gameUserRepository.findOne({
            where: { address },
        });
        const isPasswordValid = await bcrypt.compare(password, user?.password);
        if (!isPasswordValid) {
            throw new BadRequestException({
                message: 'Invalid address or password',
            });
        }
        const payload: JwtPayload = { address: user.address, id: user.id };
        return {
            accessToken: await this.jwtService.signAsync(payload),
        };
    }

    async getUserInfo(id: GameUser['id']): Promise<ResUserInfoDto> {
        const user = await this.gameUserRepository.findOne({ where: { id } });
        if (!user) {
            throw new NotFoundException();
        }
        return new ResUserInfoDto(user);
    }

    async deleteUser(id: GameUser['id']): Promise<Record<string, any>> {
        const deletedUser = await this.gameUserRepository.delete({ id });
        if (!deletedUser) {
            throw new NotFoundException();
        }
        return {
            id,
            data: deletedUser.raw,
            message: 'User deleted successfully',
        };
    }
}
