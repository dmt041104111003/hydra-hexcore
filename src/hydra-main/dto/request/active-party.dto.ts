import { IsNumber } from 'class-validator';

export class ReqActivePartyDto {
  @IsNumber()
  id: number;
}
