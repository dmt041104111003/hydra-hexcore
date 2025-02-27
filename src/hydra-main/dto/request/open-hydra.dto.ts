import { IsNumber, IsString } from 'class-validator';

export class OpenHydraDto {
  @IsNumber()
  partyId: number;

  @IsNumber()
  hydraHeadId: number;

  @IsString()
  transation: string;
}
