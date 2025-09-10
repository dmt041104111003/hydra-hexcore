import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { BaseResponseInterceptor } from './common/interceptors/base-response.interceptor';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './config/swagger.config';
import { ResolvePromisesInterceptor } from './common/interceptors/serializer.interceptor';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    });
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    );
    app.useGlobalInterceptors(
        // ResolvePromisesInterceptor is used to resolve promises in responses because class-transformer can't do it
        // https://github.com/typestack/class-transformer/issues/549
        new ResolvePromisesInterceptor(),
        // new ClassSerializerInterceptor(app.get(Reflector)),
        new BigIntInterceptor(),
        new BaseResponseInterceptor(),
    );
    const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, documentFactory, {});
    await app.listen(process.env.PORT ?? 3000, () => {
        console.log(`Server is running on Port:${process.env.PORT ?? 3000}`);
        console.log(`Swagger is running on http://localhost:${process.env.PORT ?? 3000}/api-docs`);
    });
}
bootstrap();
