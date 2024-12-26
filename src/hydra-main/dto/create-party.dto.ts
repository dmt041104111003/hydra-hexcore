import { ArrayNotEmpty, IsArray, IsNumber } from 'class-validator';

export class CreatePartyDto {
  @IsNumber()
  nodes: number;

  description?: string;

  @IsArray({ context: { each: 'number' } })
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  cardanoAccountIds: number[];
}
