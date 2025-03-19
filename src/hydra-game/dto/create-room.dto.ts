import { IsString, IsNumber } from 'class-validator';

export class CreateRoomDto {
  @IsNumber()
  partyId: number;

  @IsString()
  name: string;
}
