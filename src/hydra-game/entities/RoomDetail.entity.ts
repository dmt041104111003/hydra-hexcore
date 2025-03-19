import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { GameRoom } from './Room.entity';
import { GameUser } from './User.entity';

@Entity()
export class GameRoomDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => GameRoom, (gameRoom) => gameRoom.gameRoomDetails)
  room: GameRoom;

  @OneToOne(() => GameUser)
  @JoinColumn()
  user: GameUser;

  @Column({
    default: new Date().toISOString(),
  })
  createdAt: string;

  @Column({
    unique: true,
  })
  port: number;
}
