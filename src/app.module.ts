import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HydraMainModule } from './hydra-main/hydra-main.module';
import { ShellModule } from './shell/shell.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    HydraMainModule,
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
