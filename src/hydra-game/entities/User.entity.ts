import { Exclude } from 'class-transformer';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class GameUser {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        unique: true,
    })
    address: string;

    @Column({
        default: '',
    })
    avatar: string;

    @Column({
        default: '',
    })
    alias: string;

    @Exclude()
    @Column()
    password: string;

    @Column({
        default: new Date().toISOString(),
    })
    createdAt: string;
}
