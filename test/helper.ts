import { DataSource } from "typeorm";
import { add } from "winston";

export const StatusConsumerType = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    BLOCKED: 'BLOCKED',
    REQUESTED: 'REQUESTED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
} as const;

export type StatusConsumer = typeof StatusConsumerType[keyof typeof StatusConsumerType];

export async function generateAdminTest() {
    return {
        username: 'admin_test',
        password: 'admin_password_test',
    }
}

export async function generateConsumerTest() {
    return {
        address: 'consumer_test',
        password: 'StrongPassword123!',
    }
}

export async function insertAdminAccount(data: { username: string; password: string }, dataSource: DataSource) {
    const userRepository = dataSource.getRepository('User');
    const user = userRepository.create({
        username: data.username,
        password: data.password,
        role: 'admin',
    });
    await userRepository.save(user);
}

export async function insertConsumerAccount(data: { address: string; password: string; status: StatusConsumer }, dataSource: DataSource) {
    const consumerRepository = dataSource.getRepository('Consumer');
    const consumer = consumerRepository.create({
        address: data.address,
        password: data.password,
        status: data.status,
    });
    await consumerRepository.save(consumer);
}

export async function clearDatabase(dataSource: DataSource) {
    if (!dataSource || !dataSource.isInitialized) {
        console.warn('DataSource is not initialized, skipping database cleanup');
        return;
    }

    const entities = dataSource.entityMetadatas;

    for (const entity of entities) {
        const repository = dataSource.getRepository(entity.name);
        await repository.clear();
    }
}
