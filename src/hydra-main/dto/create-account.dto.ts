import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAccountDto {
    @IsString()
    @IsNotEmpty()
    mnemonic: string;
}
