import { Exclude } from 'class-transformer';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Account {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  baseAddress: string;

  @Exclude()
  @Column({
    unique: true,
  })
  mnemonic: string;

  @Column({
    default: new Date().toISOString(),
  })
  createdAt: string;
}
