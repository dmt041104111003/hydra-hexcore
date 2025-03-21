import { IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class UpdateUserDto {
    @IsString()
    @IsUrl()
    @IsOptional()
    avatar?: string;

    @IsString()
    @Length(6, 255)
    @IsOptional()
    alias?: string;
}
