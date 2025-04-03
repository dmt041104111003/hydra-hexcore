import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './entities/User.entity';
import { AdminLoginDto } from './dto/admin-login.dto';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
@Injectable()
export class HydraAdminService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService,
    ) {}

    async login(loginDto: AdminLoginDto) {
        const user = await this.userRepository.findOne({ where: { username: loginDto.username } });
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        if (user.password !== loginDto.password) {
            throw new UnauthorizedException('Invalid credentials');
        }
        const payload = { username: user.username, sub: user.id, role: user.role };
        return {
            accessToken: await this.jwtService.signAsync(payload),
        };
    }

    async auth(id: number) {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        return user;
    }
}
