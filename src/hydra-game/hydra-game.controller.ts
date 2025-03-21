import {
    Body,
    ClassSerializerInterceptor,
    Controller,
    Delete,
    Get,
    Query,
    Param,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    UseGuards,
    UseInterceptors,
    Put,
} from '@nestjs/common';
import { HydraGameService } from './hydra-game.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UserLoginDto } from './dto/user-login.dto';
import { JwtPayload } from './interfaces/jwtPayload.type';
import { AuthGuard } from 'src/auth/auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('hydra-game')
export class HydraGameController {
    constructor(private hydraGameService: HydraGameService) {}

    @UseInterceptors(ClassSerializerInterceptor)
    @Post('create-user')
    createUser(@Body() createUserDto: CreateUserDto) {
        return this.hydraGameService.createUser(createUserDto);
    }

    @UseInterceptors(ClassSerializerInterceptor)
    @HttpCode(HttpStatus.OK)
    @Post('login')
    login(@Body() userLoginDto: UserLoginDto) {
        return this.hydraGameService.signIn(userLoginDto);
    }

    @UseInterceptors(ClassSerializerInterceptor)
    @UseGuards(AuthGuard)
    @HttpCode(200)
    @Get('user-info')
    auth(@Req() req: any) {
        const user = req.user as JwtPayload;
        return this.hydraGameService.getUserInfo(user.id);
    }

    @UseInterceptors(ClassSerializerInterceptor)
    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    @Put('user-info')
    updateUserInfo(@Body() updateUserDto: UpdateUserDto, @Req() req: any) {
        const user = req.user as JwtPayload;
        return this.hydraGameService.updateUserInfo(user.id, updateUserDto);
    }

    @UseInterceptors(ClassSerializerInterceptor)
    @HttpCode(200)
    @Get('address/:address')
    getUserInfoByAddress(@Param('address') address: string) {
        return this.hydraGameService.getUserInfoByAddress(address);
    }

    @UseInterceptors(ClassSerializerInterceptor)
    @UseGuards(AuthGuard)
    @HttpCode(200)
    @Delete('delete-user')
    deleteUser(@Req() req: any) {
        const user = req.user as JwtPayload;
        return this.hydraGameService.deleteUser(user.id);
    }

    @Post('create-room')
    createRoom(@Body() createRoomDto: CreateRoomDto) {
        return this.hydraGameService.createRoom(createRoomDto);
    }

    @Get('rooms')
    getListGameRoom(@Query() query: any) {
        return this.hydraGameService.getListRoom(query);
    }

    @Get('room/:id')
    getGameRoom(@Param('id') id: number) {
        return this.hydraGameService.getRoom(id);
    }

    @Put('room/:id')
    editGameRoom(@Param('id') id: number, @Body() editRoomDto: Partial<CreateRoomDto>) {
        return this.hydraGameService.editRoom(id, editRoomDto);
    }
}
