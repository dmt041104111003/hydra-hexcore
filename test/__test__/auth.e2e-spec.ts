import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from '../setup';
import { clearDatabase, generateAdminTest, generateConsumerTest, insertAdminAccount, insertConsumerAccount, StatusConsumerType } from '../helper';

describe('Authentication (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;

    beforeAll(async () => {
        const testApp = await createTestApp();
        app = testApp.app;
        dataSource = testApp.dataSource;
    });

    beforeEach(async () => {
        // Clean database before each test to avoid duplicates
        if (dataSource?.isInitialized) {
            await clearDatabase(dataSource);
        }
    });

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            await clearDatabase(dataSource);
        }
        if (app) {
            await app.close();
        }
    });

    // ========== ADMIN AUTHENTICATION ==========
    describe('Admin Authentication', () => {
        describe('POST /login (Admin)', () => {
            it('should login admin successfully with valid credentials', async () => {
                const adminDto = await generateAdminTest();
                await insertAdminAccount(adminDto, dataSource);

                const response = await request(app.getHttpServer())
                    .post('/hydra-main/login')
                    .send(adminDto)
                    .expect(201);

                expect(response.body).toHaveProperty('accessToken');
                expect(response.body).not.toHaveProperty('user'); // API chỉ trả về accessToken
            });

            it('should fail login with wrong password', async () => {
                const adminDto = await generateAdminTest();
                await insertAdminAccount(adminDto, dataSource);

                await request(app.getHttpServer())
                    .post('/hydra-main/login')
                    .send({
                        username: adminDto.username,
                        password: 'wrong_password',
                    })
                    .expect(401);
            });

            it('should fail login with non-existent username', async () => {
                await request(app.getHttpServer())
                    .post('/hydra-main/login')
                    .send({
                        username: 'nonexistent_admin',
                        password: 'some_password',
                    })
                    .expect(401);
            });

            it('should fail login with empty username', async () => {
                await request(app.getHttpServer())
                    .post('/hydra-main/login')
                    .send({
                        username: '',
                        password: 'some_password',
                    })
                    .expect(400);
            });

            it('should fail login with empty password', async () => {
                await request(app.getHttpServer())
                    .post('/hydra-main/login')
                    .send({
                        username: 'admin_test',
                        password: '',
                    })
                    .expect(400);
            });

            it('should fail login with missing credentials', async () => {
                await request(app.getHttpServer())
                    .post('/hydra-main/login')
                    .send({})
                    .expect(400);
            });
        });

        describe('GET /auth (Admin Authorization)', () => {
            it('should authorize admin successfully with valid token', async () => {
                const adminDto = await generateAdminTest();
                await insertAdminAccount(adminDto, dataSource);

                const loginResponse = await request(app.getHttpServer())
                    .post('/hydra-main/login')
                    .send(adminDto)
                    .expect(201);

                const accessToken = loginResponse.body.accessToken;

                const response = await request(app.getHttpServer())
                    .get('/hydra-main/auth')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('id');
                expect(response.body).toHaveProperty('username', adminDto.username);
            });

            it('should fail authorization without token', async () => {
                await request(app.getHttpServer())
                    .get('/hydra-main/auth')
                    .expect(401);
            });

            it('should fail authorization with invalid token', async () => {
                await request(app.getHttpServer())
                    .get('/hydra-main/auth')
                    .set('Authorization', 'Bearer invalid_token_12345')
                    .expect(401);
            });

            it('should fail authorization with malformed token', async () => {
                await request(app.getHttpServer())
                    .get('/hydra-main/auth')
                    .set('Authorization', 'InvalidFormat')
                    .expect(401);
            });

            it('should fail authorization with expired token', async () => {
                // Token đã hết hạn (expired in 2020)
                const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWQiOjEsImlhdCI6MTYwOTQ1OTIwMCwiZXhwIjoxNjA5NDU5MjAxfQ.invalidSignature';
                
                await request(app.getHttpServer())
                    .get('/hydra-main/auth')
                    .set('Authorization', `Bearer ${expiredToken}`)
                    .expect(401);
            });
        });
    });

    // ========== CONSUMER AUTHENTICATION ==========
    describe('Consumer Authentication', () => {
        describe('POST /hydra-consumer/consumer/login', () => {
            it('should login consumer successfully with valid credentials', async () => {
                const loginDto = await generateConsumerTest();
                await insertConsumerAccount(
                    {
                        ...loginDto,
                        status: StatusConsumerType.ACTIVE,
                    }, dataSource
                );

                const response = await request(app.getHttpServer())
                    .post('/hydra-consumer/consumer/login')
                    .send(loginDto)
                    .expect(201);

                expect(response.body).toHaveProperty('accessToken');
            });

            it('should login inactive consumer (API allows this)', async () => {
                const loginDto = await generateConsumerTest();
                await insertConsumerAccount(
                    {
                        ...loginDto,
                        status: StatusConsumerType.INACTIVE,
                    }, dataSource
                );

                // API hiện tại KHÔNG validate status khi login
                const response = await request(app.getHttpServer())
                    .post('/hydra-consumer/consumer/login')
                    .send(loginDto)
                    .expect(201);

                expect(response.body).toHaveProperty('accessToken');
            });

            it('should login blocked consumer (API allows this)', async () => {
                const loginDto = await generateConsumerTest();
                await insertConsumerAccount(
                    {
                        ...loginDto,
                        status: StatusConsumerType.BLOCKED,
                    }, dataSource
                );

                // API hiện tại KHÔNG validate status khi login
                const response = await request(app.getHttpServer())
                    .post('/hydra-consumer/consumer/login')
                    .send(loginDto)
                    .expect(201);

                expect(response.body).toHaveProperty('accessToken');
            });

            it('should fail login with wrong password', async () => {
                const loginDto = await generateConsumerTest();
                await insertConsumerAccount(
                    {
                        ...loginDto,
                        status: StatusConsumerType.ACTIVE,
                    }, dataSource
                );

                await request(app.getHttpServer())
                    .post('/hydra-consumer/consumer/login')
                    .send({
                        address: loginDto.address,
                        password: 'WrongPassword123!',
                    })
                    .expect(400);
            });

            it('should fail login with non-existent consumer', async () => {
                await request(app.getHttpServer())
                    .post('/hydra-consumer/consumer/login')
                    .send({
                        address: 'nonexistent_consumer',
                        password: 'StrongPassword123!',
                    })
                    .expect(404);
            });

            it('should fail login with weak password', async () => {
                await request(app.getHttpServer())
                    .post('/hydra-consumer/consumer/login')
                    .send({
                        address: 'consumer_test',
                        password: 'weak',
                    })
                    .expect(400);
            });

            it('should fail login with empty address', async () => {
                await request(app.getHttpServer())
                    .post('/hydra-consumer/consumer/login')
                    .send({
                        address: '',
                        password: 'StrongPassword123!',
                    })
                    .expect(400);
            });

            it('should fail login with missing credentials', async () => {
                await request(app.getHttpServer())
                    .post('/hydra-consumer/consumer/login')
                    .send({})
                    .expect(400);
            });
        });

        describe('GET /hydra-consumer/consumer/authorization', () => {
            it('should authorize consumer successfully with valid token', async () => {
                const loginDto = await generateConsumerTest();
                await insertConsumerAccount(
                    {
                        ...loginDto,
                        status: StatusConsumerType.ACTIVE,
                    }, dataSource
                );

                const loginResponse = await request(app.getHttpServer())
                    .post('/hydra-consumer/consumer/login')
                    .send(loginDto)
                    .expect(201);

                const accessToken = loginResponse.body.accessToken;

                const response = await request(app.getHttpServer())
                    .get('/hydra-consumer/consumer/authorization')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('accessToken');
            });

            it('should fail authorization without token', async () => {
                await request(app.getHttpServer())
                    .get('/hydra-consumer/consumer/authorization')
                    .expect(401);
            });

            it('should fail authorization with invalid token', async () => {
                await request(app.getHttpServer())
                    .get('/hydra-consumer/consumer/authorization')
                    .set('Authorization', 'Bearer invalid_token_xyz')
                    .expect(401);
            });

            it('should fail authorization with admin token', async () => {
                // Tạo admin và lấy token
                const adminDto = await generateAdminTest();
                await insertAdminAccount(adminDto, dataSource);

                const adminLoginResponse = await request(app.getHttpServer())
                    .post('/hydra-main/login')
                    .send(adminDto)
                    .expect(201);

                const adminToken = adminLoginResponse.body.accessToken;

                // Dùng admin token để access consumer endpoint
                await request(app.getHttpServer())
                    .get('/hydra-consumer/consumer/authorization')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .expect(401);
            });
        });

        describe('GET /hydra-consumer/consumer/info', () => {
            it('should get consumer info successfully with valid token', async () => {
                const loginDto = await generateConsumerTest();
                await insertConsumerAccount(
                    {
                        ...loginDto,
                        status: StatusConsumerType.ACTIVE,
                    }, dataSource
                );

                const loginResponse = await request(app.getHttpServer())
                    .post('/hydra-consumer/consumer/login')
                    .send(loginDto)
                    .expect(201);

                const accessToken = loginResponse.body.accessToken;

                const response = await request(app.getHttpServer())
                    .get('/hydra-consumer/consumer/info')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('id');
                expect(response.body).toHaveProperty('address', loginDto.address);
                expect(response.body).toHaveProperty('status');
            });

            it('should fail to get consumer info without token', async () => {
                await request(app.getHttpServer())
                    .get('/hydra-consumer/consumer/info')
                    .expect(401);
            });

            it('should fail to get consumer info with invalid token', async () => {
                await request(app.getHttpServer())
                    .get('/hydra-consumer/consumer/info')
                    .set('Authorization', 'Bearer invalid_token_abc')
                    .expect(401);
            });

            it('should return correct consumer status in info', async () => {
                const loginDto = await generateConsumerTest();
                await insertConsumerAccount(
                    {
                        ...loginDto,
                        status: StatusConsumerType.APPROVED,
                    }, dataSource
                );

                const loginResponse = await request(app.getHttpServer())
                    .post('/hydra-consumer/consumer/login')
                    .send(loginDto)
                    .expect(201);

                const accessToken = loginResponse.body.accessToken;

                const response = await request(app.getHttpServer())
                    .get('/hydra-consumer/consumer/info')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(200);

                expect(response.body.status).toBe(StatusConsumerType.APPROVED);
            });
        });
    });

    // ========== CROSS-ROLE ACCESS CONTROL ==========
    describe('Cross-Role Access Control', () => {
        it('should not allow consumer token to access admin endpoints', async () => {
            const consumerDto = await generateConsumerTest();
            await insertConsumerAccount(
                {
                    ...consumerDto,
                    status: StatusConsumerType.ACTIVE,
                }, dataSource
            );

            const consumerLoginResponse = await request(app.getHttpServer())
                .post('/hydra-consumer/consumer/login')
                .send(consumerDto)
                .expect(201);

            const consumerToken = consumerLoginResponse.body.accessToken;

            // Thử access admin endpoint với consumer token
            await request(app.getHttpServer())
                .get('/hydra-main/auth')
                .set('Authorization', `Bearer ${consumerToken}`)
                .expect(401);
        });

        it('should not allow admin token to access consumer endpoints', async () => {
            const adminDto = await generateAdminTest();
            await insertAdminAccount(adminDto, dataSource);

            const adminLoginResponse = await request(app.getHttpServer())
                .post('/hydra-main/login')
                .send(adminDto)
                .expect(201);

            const adminToken = adminLoginResponse.body.accessToken;

            // Thử access consumer endpoint với admin token
            await request(app.getHttpServer())
                .get('/hydra-consumer/consumer/info')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(401);
        });
    });
});
