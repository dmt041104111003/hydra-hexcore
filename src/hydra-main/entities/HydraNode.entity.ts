import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Account } from './Account.entity';
import { HydraParty } from './HydraParty.entity';

@Entity()
export class HydraNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
    default: 'hydra-node',
  })
  description: string;

  @Column({
    unique: true,
  })
  port: number;

  @Column()
  skey: string;

  @Column()
  vkey: string;

  @ManyToOne(() => Account, (account) => account.id)
  cardanoAccount: Account;

  @ManyToOne(() => HydraParty, (hydraParty) => hydraParty.hydraNodes)
  party: HydraParty;

  @Column({
    default: new Date().toISOString(),
  })
  createdAt: string;
}
