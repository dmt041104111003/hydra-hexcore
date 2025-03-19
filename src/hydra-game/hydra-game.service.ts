import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Docker from 'dockerode';
import bcrypt from 'bcryptjs';

import { HydraParty } from '../hydra-main/entities/HydraParty.entity';
import { GameUser } from './entities/User.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { GameRoom } from './entities/Room.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { GameRoomDetail } from './entities/RoomDetail.entity';
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
        @InjectRepository(GameUser)
        private gameUserRepository: Repository<GameUser>,
        @InjectRepository(GameRoom)
        private gameRoomRepository: Repository<GameRoom>,
        private jwtService: JwtService,
    ) {
        const DOCKER_SOCKET = process.env.NEST_DOCKER_SOCKET_PATH || '\\\\.\\pipe\\docker_engine';
        this.docker = new Docker({ socketPath: DOCKER_SOCKET });
    }

    async onModuleInit() { }

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
            // .leftJoinAndSelect('party.hydraNodes', 'hydraNodes')
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
