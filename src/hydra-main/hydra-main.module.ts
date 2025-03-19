import { Module } from '@nestjs/common';
import { HydraMainService } from './hydra-main.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HydraNode } from './entities/HydraNode.entity';
import { HydraMainController } from './hydra-main.controller';
import { Account } from './entities/Account.entity';
import { HydraParty } from './entities/HydraParty.entity';
import { HydraMainGateway } from './hydra-main.gateway';

import { GameRoom } from '../hydra-game/entities/Room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([HydraNode, Account, HydraParty, GameRoom])],
  providers: [HydraMainService, HydraMainGateway],
  controllers: [HydraMainController],
})
export class HydraMainModule { }
