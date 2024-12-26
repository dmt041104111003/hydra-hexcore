import { Exclude } from 'class-transformer';

export class ResCardanoAccountDto {
  id: number;

  baseAddress: string;

  @Exclude()
  mnemonic: string;

  createdAt: string;

  constructor(partial: Partial<ResCardanoAccountDto>) {
    Object.assign(this, partial);
  }
}
