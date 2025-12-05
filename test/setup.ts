import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';


/**
 * Setup shared test application (Full App)
 * Tạo NestJS app instance với validation pipes
 * Sử dụng database test riêng biệt
 */
export async function createTestApp(): Promise<{
    app: INestApplication;
    dataSource: DataSource;
    moduleFixture: TestingModule;
}> {
    // Override environment variables để sử dụng test database
    process.env.DB_PORT = process.env.DB_PORT_TEST || '3328';
    process.env.DB_USERNAME = process.env.DB_USERNAME_TEST || 'hexcore_user';
    process.env.DB_PASSWORD = process.env.DB_PASSWORD_TEST || 'hexcore_password';
    process.env.DB_DATABASE = process.env.DB_NAME_TEST || 'hexcore_test_db';
    process.env.DB_SYNCHRONIZE = 'true'; // Auto sync schema cho test

    console.log('🧪 [TEST DATABASE CONFIG]', {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_DATABASE,
        username: process.env.DB_USERNAME,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();

    // Apply global pipes (giống main.ts)
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    await app.init();

    // Get DataSource để có thể truy cập database
    const dataSource = moduleFixture.get<DataSource>(DataSource);

    // Disable foreign key constraints for testing (MySQL)
    // This allows tests to create entities in any order without constraint violations
    if (dataSource.isInitialized) {
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 0;');
    }

    return { app, dataSource, moduleFixture };
}
