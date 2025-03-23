import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

export class QueryHydraDto {
    @ApiPropertyOptional()
    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => {
        return value ? Number(value) : 1;
    })
    page?: number;

    @ApiPropertyOptional()
    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => (value ? Number(value) : 10))
    limit?: number;

    // @ApiPropertyOptional({ type: String })
    // @IsOptional()
    // @Transform(({ value }) =>
    //   value ? plainToInstance(FilterUserDto, JSON.parse(value)) : undefined,
    // )
    // @ValidateNested()
    // @Type(() => FilterUserDto)
    // filters?: FilterUserDto | null;

    // @ApiPropertyOptional({ type: String })
    // @IsOptional()
    // @Transform(({ value }) => {
    //   return value ? plainToInstance(SortUserDto, JSON.parse(value)) : undefined;
    // })
    // @ValidateNested({ each: true })
    // @Type(() => SortUserDto)
    // sort?: SortUserDto[] | null;
}
