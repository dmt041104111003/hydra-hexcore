import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HydraMainModule } from './hydra-main/hydra-main.module';
import { HydraGameModule } from './hydra-game/hydra-game.module';
import { ShellModule } from './shell/shell.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: '.env',
        }),
        ScheduleModule.forRoot(),
        HydraMainModule,
        HydraGameModule,
        ShellModule,
        TypeOrmModule.forRoot({
            type: 'sqlite', // Database type
            database: 'database/database.sqlite', // SQLite file
            entities: [__dirname + '/**/*.entity{.ts,.js}'], // Path to entities
            synchronize: true, // Auto-create database schema
        }),
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
