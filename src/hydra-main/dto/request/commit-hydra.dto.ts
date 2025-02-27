import { IsNumber } from 'class-validator';

export class CommitHydraDto {
  @IsNumber()
  partyId: number;

  @IsNumber()
  hydraHeadId: number;

  utxo: Record<string, any>;
}
