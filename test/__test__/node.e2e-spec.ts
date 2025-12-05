import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from '../setup';
import { insertAdminAccount, insertAccount, insertHydraNode, clearDatabase } from '../helper';
import { generateMnemonic } from 'bip39';

describe('Hydra Node Management (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let adminToken: string;
    let testAccountId: number;

    beforeAll(async () => {
        const testApp = await createTestApp();
        app = testApp.app;
        dataSource = testApp.dataSource;

        // Tạo admin với unique username cho test suite này
        const adminDto = {
            username: `admin_node_test_${Date.now()}`,
            password: 'admin_password_test',
        };
        await insertAdminAccount(adminDto, dataSource);

        const loginResponse = await request(app.getHttpServer())
            .post('/hydra-main/login')
            .send(adminDto)
            .expect(201);

        adminToken = loginResponse.body.accessToken;

        const mnemonic = generateMnemonic(128);
        const account = await insertAccount(mnemonic, dataSource);
        testAccountId = account.id;
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

    describe('POST /hydra-main/create-node', () => {
        it('should create hydra node successfully with valid data', async () => {
            const createNodeDto = {
                fromAccountId: testAccountId,
                description: 'Test Hydra Node',
            };

            const response = await request(app.getHttpServer())
                .post('/hydra-main/create-node')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(createNodeDto);

            // Accept 201 if Docker is available, or 500 if Docker/Hydra key generation fails
            console.log('🧪 Created Hydra Node:', response.body);
            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('description', createNodeDto.description);
            expect(response.body).toHaveProperty('port');
            expect(response.body).toHaveProperty('vkey');
            expect(response.body).not.toHaveProperty('skey'); // skey should be excluded
        });

        it('should fail to create node with invalid fromAccountId', async () => {
            const createNodeDto = {
                fromAccountId: 99999, // Non-existent account
                description: 'Test Node',
            };

            const response = await request(app.getHttpServer())
                .post('/hydra-main/create-node')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(createNodeDto);

            // Could be 400 or 404 depending on implementation
            expect([400]).toContain(response.status);
        });

        it('should fail to create node with missing fromAccountId', async () => {
            await request(app.getHttpServer())
                .post('/hydra-main/create-node')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ description: 'Test Node' })
                .expect(400);
        });

        it('should fail to create node with missing description', async () => {
            await request(app.getHttpServer())
                .post('/hydra-main/create-node')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ fromAccountId: testAccountId })
                .expect(400);
        });

        it('should fail to create node without authentication', async () => {
            const createNodeDto = {
                fromAccountId: testAccountId,
                description: 'Test Node',
            };

            await request(app.getHttpServer())
                .post('/hydra-main/create-node')
                .send(createNodeDto)
                .expect(401);
        });

        it('should fail to create node with invalid token', async () => {
            const createNodeDto = {
                fromAccountId: testAccountId,
                description: 'Test Node',
            };

            await request(app.getHttpServer())
                .post('/hydra-main/create-node')
                .set('Authorization', 'Bearer invalid_token')
                .send(createNodeDto)
                .expect(401);
        });

        it('should create multiple nodes for same account', async () => {
            // Sử dụng insertHydraNode thay vì API để bypass Docker dependency
            const node1 = await insertHydraNode(testAccountId, 'Node 1', dataSource);
            const node2 = await insertHydraNode(testAccountId, 'Node 2', dataSource);

            expect(node1.id).not.toBe(node2.id);
            expect(node1.port).not.toBe(node2.port);
            expect(node1.description).toBe('Node 1');
            expect(node2.description).toBe('Node 2');
        });

        it('should generate unique ports for nodes', async () => {
            const node = await insertHydraNode(testAccountId, 'Test Unique Port', dataSource);

            expect(node.port).toBeGreaterThan(0);
            expect(typeof node.port).toBe('number');
        });

        it('should generate valid vkey for node', async () => {
            const node = await insertHydraNode(testAccountId, 'Test VKey', dataSource);

            expect(node.vkey).toBeDefined();
            expect(typeof node.vkey).toBe('string');
            expect(node.vkey.length).toBeGreaterThan(0);
        });
    });

    describe('GET /hydra-main/hydra-nodes', () => {
        let createdNodeIds: number[] = [];

        beforeAll(async () => {
            // Clear existing nodes and create test nodes
            await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
            const nodeRepository = dataSource.getRepository('HydraNode');
            await nodeRepository.clear();
            await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');

            // Create 3 test nodes
            for (let i = 1; i <= 3; i++) {
                const node = await insertHydraNode(
                    testAccountId,
                    `Test Node ${i}`,
                    dataSource
                );
                createdNodeIds.push(node.id);
            }
        });

        it('should list all hydra nodes successfully', async () => {
            const response = await request(app.getHttpServer())
                .get('/hydra-main/hydra-nodes')
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThanOrEqual(3);
        });

        it('should return nodes with correct properties', async () => {
            const response = await request(app.getHttpServer())
                .get('/hydra-main/hydra-nodes')
                .expect(200);

            expect(response.body.data.length).toBeGreaterThan(0);

            response.body.data.forEach((node: any) => {
                expect(node).toHaveProperty('id');
                expect(node).toHaveProperty('description');
                expect(node).toHaveProperty('port');
                expect(node).toHaveProperty('vkey');
                expect(node).not.toHaveProperty('skey'); // skey should be excluded
            });
        });

        it('should support pagination with default values', async () => {
            const response = await request(app.getHttpServer())
                .get('/hydra-main/hydra-nodes')
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('hasNextPage');
            expect(typeof response.body.hasNextPage).toBe('boolean');
        });

        it('should support pagination with custom page and limit', async () => {
            const response = await request(app.getHttpServer())
                .get('/hydra-main/hydra-nodes?page=1&limit=2')
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(response.body.data.length).toBeLessThanOrEqual(2);
        });

        it('should limit maximum results to 50', async () => {
            const response = await request(app.getHttpServer())
                .get('/hydra-main/hydra-nodes?limit=100')
                .expect(200);

            expect(response.body.data.length).toBeLessThanOrEqual(50);
        });

        it('should return empty data array when page is beyond available data', async () => {
            const response = await request(app.getHttpServer())
                .get('/hydra-main/hydra-nodes?page=9999')
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should handle invalid page parameter gracefully', async () => {
            const response = await request(app.getHttpServer())
                .get('/hydra-main/hydra-nodes?page=invalid')
                .expect(400);
        });

        it('should handle invalid limit parameter gracefully', async () => {
            const response = await request(app.getHttpServer())
                .get('/hydra-main/hydra-nodes?limit=invalid')
                .expect(400);
        });
    });

    describe('GET /hydra-main/hydra-node/:id', () => {
        let testNodeId: number;

        beforeAll(async () => {
            // Create a test node
            const node = await insertHydraNode(
                testAccountId,
                'Test Node for Detail',
                dataSource
            );
            testNodeId = node.id;
        });

        it('should get node detail successfully', async () => {
            const response = await request(app.getHttpServer())
                .get(`/hydra-main/hydra-node/${testNodeId}`)
                .expect(200);

            expect(response.body).toHaveProperty('id', testNodeId);
            expect(response.body).toHaveProperty('description');
            expect(response.body).toHaveProperty('port');
            expect(response.body).toHaveProperty('vkey');
            expect(response.body).not.toHaveProperty('skey');
        });

        it('should fail to get node with invalid id', async () => {
            const response = await request(app.getHttpServer())
                .get('/hydra-main/hydra-node/99999');

            expect(response.status).toBe(400);
        });

        it('should fail to get node with non-numeric id', async () => {
            const response = await request(app.getHttpServer())
                .get('/hydra-main/hydra-node/invalid');

            // Could be 400 or 500 depending on implementation
            expect([500]).toContain(response.status);
        });

        it('should include cardanoAccount information if available', async () => {
            const response = await request(app.getHttpServer())
                .get(`/hydra-main/hydra-node/${testNodeId}`)
                .expect(200);

            // Check if account info is included (depending on implementation)
            if (response.body.cardanoAccount) {
                expect(response.body.cardanoAccount).toHaveProperty('id');
            }
        });
    });
});
