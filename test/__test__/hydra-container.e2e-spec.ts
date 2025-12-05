import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Cache } from 'cache-manager';
import { createTestApp } from '../setup';
import { insertAdminAccount, insertAccount, clearDatabase } from '../helper';
import { generateMnemonic } from 'bip39';

describe('Hydra Node Containers (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let cacheManager: Cache;
    let adminToken: string;
    let testAccountId: number;

    beforeAll(async () => {
        const testApp = await createTestApp();
        app = testApp.app;
        dataSource = testApp.dataSource;

        // Get cache manager from app using string token
        cacheManager = app.get('CACHE_MANAGER');

        // Tạo unique admin cho test suite này
        const adminDto = {
            username: `admin_container_test_${Date.now()}`,
            password: 'admin_password_test',
        };
        await insertAdminAccount(adminDto, dataSource);

        const loginResponse = await request(app.getHttpServer()).post('/hydra-main/login').send(adminDto).expect(201);

        adminToken = loginResponse.body.accessToken;

        // Tạo test account
        const mnemonic = generateMnemonic(128);
        const account = await insertAccount(mnemonic, dataSource);
        testAccountId = account.id;
    });

    beforeEach(async () => {
        // Clear cache before each test by setting to empty array
        await cacheManager.set('activeNodes', []);
    });

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            await clearDatabase(dataSource);
            await dataSource.destroy();
        }
        if (app) {
            await app.close();
        }
    });

    describe('GET /hydra-main/active-nodes - Basic Functionality', () => {
        it('should return empty array when no active nodes in cache', async () => {
            // Cache is empty (cleared in beforeEach)
            const response = await request(app.getHttpServer()).get('/hydra-main/active-nodes');

            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });

        it('should return active nodes from cache', async () => {
            // Setup: Insert fake data into cache
            const fakeActiveNodes = [
                {
                    hydraNodeId: '1',
                    hydraPartyId: '101',
                    container: {
                        Id: 'container-1',
                        Names: ['/hexcore-hydra-node-1'],
                        Image: 'hydra-node:latest',
                        State: 'running',
                        Status: 'Up 2 hours',
                    },
                    isActive: true,
                },
                {
                    hydraNodeId: '2',
                    hydraPartyId: '102',
                    container: {
                        Id: 'container-2',
                        Names: ['/hexcore-hydra-node-2'],
                        Image: 'hydra-node:latest',
                        State: 'running',
                        Status: 'Up 1 hour',
                    },
                    isActive: true,
                },
            ];

            await cacheManager.set('activeNodes', fakeActiveNodes);

            // Test: Get active nodes
            const response = await request(app.getHttpServer()).get('/hydra-main/active-nodes');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(fakeActiveNodes);
            expect(response.body.length).toBe(2);
            expect(response.body[0]).toHaveProperty('hydraNodeId');
            expect(response.body[0]).toHaveProperty('hydraPartyId');
            expect(response.body[0]).toHaveProperty('container');
            expect(response.body[0]).toHaveProperty('isActive');
            expect(response.body[0].container).toHaveProperty('Id');
            expect(response.body[0].container).toHaveProperty('Names');
            expect(response.body[0].container).toHaveProperty('State');
        });
    });

    describe('GET /hydra-main/active-nodes - Cache Behavior', () => {
        it('should return same data on consecutive calls', async () => {
            const fakeData = [
                {
                    hydraNodeId: '1',
                    hydraPartyId: '101',
                    container: { Id: 'test-1', State: 'running' },
                    isActive: true,
                },
            ];

            await cacheManager.set('activeNodes', fakeData);

            const response1 = await request(app.getHttpServer()).get('/hydra-main/active-nodes');
            const response2 = await request(app.getHttpServer()).get('/hydra-main/active-nodes');

            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);
            expect(response1.body).toEqual(response2.body);
        });

        it('should handle cache updates correctly', async () => {
            // Initial state: empty
            let response = await request(app.getHttpServer()).get('/hydra-main/active-nodes');
            expect(response.body).toEqual([]);

            // Update cache with 1 node
            await cacheManager.set('activeNodes', [
                { hydraNodeId: '1', hydraPartyId: '101', container: {}, isActive: true },
            ]);

            response = await request(app.getHttpServer()).get('/hydra-main/active-nodes');
            expect(response.body.length).toBe(1);

            // Update cache with 2 nodes
            await cacheManager.set('activeNodes', [
                { hydraNodeId: '1', hydraPartyId: '101', container: {}, isActive: true },
                { hydraNodeId: '2', hydraPartyId: '102', container: {}, isActive: true },
            ]);

            response = await request(app.getHttpServer()).get('/hydra-main/active-nodes');
            expect(response.body.length).toBe(2);
        });
    });

    describe('GET /hydra-main/active-nodes - Performance', () => {
        it('should respond quickly when reading from cache', async () => {
            await cacheManager.set('activeNodes', []);

            const startTime = Date.now();
            await request(app.getHttpServer()).get('/hydra-main/active-nodes');
            const duration = Date.now() - startTime;

            // Reading from cache should be very fast (< 1 second)
            expect(duration).toBeLessThan(500);
        });

        it('should handle large number of nodes efficiently', async () => {
            // Create 100 fake nodes
            const manyNodes = Array.from({ length: 100 }, (_, i) => ({
                hydraNodeId: `${i + 1}`,
                hydraPartyId: `${100 + i}`,
                container: {
                    Id: `container-${i + 1}`,
                    Names: [`/hexcore-hydra-node-${i + 1}`],
                    State: 'running',
                },
                isActive: true,
            }));

            await cacheManager.set('activeNodes', manyNodes);

            const startTime = Date.now();
            const response = await request(app.getHttpServer()).get('/hydra-main/active-nodes');
            const duration = Date.now() - startTime;

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(100);
            expect(duration).toBeLessThan(1000); // Still fast even with 100 nodes
        });
    });
});
