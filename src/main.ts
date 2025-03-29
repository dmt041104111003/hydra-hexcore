import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BaseResponseInterceptor } from './common/interceptors/base-response.interceptor';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    });
    app.useGlobalInterceptors(new BaseResponseInterceptor());
    app.useGlobalPipes(new ValidationPipe());
    await app.listen(process.env.PORT ?? 3000, () => {
        console.log(`Server is running on Port:${process.env.PORT ?? 3000}`);
    });
}
bootstrap();
