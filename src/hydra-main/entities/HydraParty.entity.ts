import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { HydraNode } from './HydraNode.entity';

@Entity()
export class HydraParty {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  description: string;

  @Column({
    default: 1,
  })
  nodes: number;

  @Column({
    type: 'enum',
    default: 'INACTIVE',
    enum: ['ACTIVE', 'INACTIVE'],
  })
  status: 'ACTIVE' | 'INACTIVE';

  @Column({
    default: new Date().toISOString(),
  })
  createdAt: string;

  @OneToMany(() => HydraNode, (hydraNode) => hydraNode.party)
  hydraNodes: HydraNode[];
}
