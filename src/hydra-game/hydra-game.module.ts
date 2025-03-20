import { Module } from '@nestjs/common';
import { HydraGameService } from './hydra-game.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HydraGameController } from './hydra-game.controller';

import { HydraNode } from '../hydra-main/entities/HydraNode.entity';
import { Account } from '../hydra-main/entities/Account.entity';
import { HydraParty } from '../hydra-main/entities/HydraParty.entity';
import { GameUser } from './entities/User.entity';
import { GameRoom } from './entities/Room.entity';
import { GameRoomDetail } from './entities/RoomDetail.entity';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from 'src/constants';
import { EventGateway } from './event.gateway';

@Module({
    imports: [
        TypeOrmModule.forFeature([HydraNode, Account, HydraParty, GameUser, GameRoom, GameRoomDetail]),
        JwtModule.register({
            global: true,
            secret: jwtConstants.secret,
            signOptions: { expiresIn: '1 weeks' },
        }),
    ],
    providers: [HydraGameService, EventGateway],
    controllers: [HydraGameController],
    exports: [EventGateway],
})
export class HydraGameModule {}
