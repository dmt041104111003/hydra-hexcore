import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { HydraParty } from '../../hydra-main/entities/HydraParty.entity';
import { GameRoomDetail } from './RoomDetail.entity';

@Entity()
export class GameRoom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  name: string;

  @OneToOne(() => HydraParty)
  @JoinColumn()
  party: HydraParty;

  @Column({
    default: 'INACTIVE',
    enum: ['ACTIVE', 'INACTIVE'],
  })
  status: 'ACTIVE' | 'INACTIVE';

  @Column({
    default: new Date().toISOString(),
  })
  createdAt: string;

  @OneToMany(() => GameRoomDetail, (gameRoomDetail) => gameRoomDetail.room)
  gameRoomDetails: GameRoomDetail[];
}
