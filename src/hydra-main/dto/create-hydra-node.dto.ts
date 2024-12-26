import { IsNumber, IsString } from 'class-validator';

export class CreateHydraNodeDto {
  @IsNumber()
  fromAccountId: number;

  @IsString()
  description: string;
}
