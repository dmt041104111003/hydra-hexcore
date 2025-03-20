import { IsString, IsNumber } from 'class-validator';

export class CreateRoomDetailDto {
  @IsNumber()
  port: number;

  @IsNumber()
  roomId: number;

  @IsNumber()
  userId: number;
}
