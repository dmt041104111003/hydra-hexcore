import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HydraMainModule } from './hydra-main/hydra-main.module';
import { ShellModule } from './shell/shell.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv, Keyv } from '@keyv/redis';
import { CacheableMemory } from 'cacheable';
import { HydraConsumerModule } from './hydra-consumer/hydra-consumer.module';
@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: '.env',
            load: [configuration],
            isGlobal: true,
        }),
        ScheduleModule.forRoot(),
        CacheModule.registerAsync({
            isGlobal: true,
            useFactory: async () => {
                return {
                    stores: [
                        new Keyv({
                            store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
                        }),
                        createKeyv({
                            url: configuration().redis.url,
                            password: configuration().redis.password,
                        }),
                    ],
                };
            },
        }),
        HydraMainModule,
        ShellModule,
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                ...configService.get('database'),
            }),
            inject: [ConfigService],
        }),
        HydraConsumerModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
