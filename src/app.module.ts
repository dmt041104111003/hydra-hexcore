import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HydraMainModule } from './hydra-main/hydra-main.module';
import { HydraGameModule } from './hydra-game/hydra-game.module';
import { ShellModule } from './shell/shell.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';

@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: '.env',
            load: [configuration],
            isGlobal: true,
        }),
        ScheduleModule.forRoot(),
        HydraMainModule,
        HydraGameModule,
        ShellModule,
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                ...configService.get('database'),
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
