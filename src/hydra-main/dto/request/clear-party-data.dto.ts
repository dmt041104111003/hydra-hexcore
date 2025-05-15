import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsNumber } from 'class-validator';

export class ReqClearPartyDataDto {

  @ApiProperty({
    type: Array,
    example: [1, 2, 3],
    description: 'Array of Hydra Party ID'
  })
  @ArrayUnique({
    message(validationArguments) {
        console.log('validationArguments', validationArguments)
        return 'ArrayUnique'
    },
  })
  ids: number[];
}
