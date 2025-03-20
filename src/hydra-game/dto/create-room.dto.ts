import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class CreateRoomDto {
    @IsNumber()
    partyId: number;

    @IsString()
    @IsNotEmpty()
    name: string;
}
