import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HydraNode } from './entities/HydraNode.entity';
import { In, Repository } from 'typeorm';
import { chmod, chmodSync, writeFileSync } from 'node:fs';
import { access, constants, readFile, unlink, mkdir, rmdir, rm } from 'node:fs/promises';
import Docker from 'dockerode';
import { Account } from './entities/Account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import {
    getBaseAddressFromMnemonic,
    getSigningKeyFromMnemonic,
    NetworkInfo,
    PaymentVerificationKey,
} from 'src/utils/cardano-core';
import { CreatePartyDto } from './dto/create-party.dto';
import { HydraParty } from './entities/HydraParty.entity';
import { CreateHydraNodeDto } from './dto/create-hydra-node.dto';
import { ResCardanoAccountDto } from './dto/response/cardano-account.dto';
import { ReqActivePartyDto } from './dto/request/active-party.dto';
import { CardanoCliJs } from 'cardanocli-js';

import * as net from 'net';
import { ResActivePartyDto } from './dto/response/active-party.dto';
import { CommitHydraDto } from './dto/request/commit-hydra.dto';
import axios from 'axios';
import { SubmitTxHydraDto } from './dto/request/submit-tx-hydra.dto';
import { AddressUtxoDto, ReferenceScript, UTxOObject, UTxOObjectValue } from './dto/response/address-utxo.dto';
import { IPaginationOptions } from 'src/interfaces/pagination.type';
import { HydraDto } from './dto/hydra.dto';

import { Cron } from '@nestjs/schedule';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { ReqClearPartyDataDto } from './dto/request/clear-party-data.dto';
import { resolvePartyDirPath, resolvePersistenceDir } from './utils/path-resolver';
import { resolveHydraNodeName } from './utils/name-resolver';
import { OgmiosClientService } from './ogmios-client.service';
import { convertUtxoToUTxOObject } from './utils/ogmios-converter';
import { convertBigIntToString } from 'src/utils/bigint.utils';

type ContainerNode = {
    hydraNodeId: string;
    hydraPartyId: string;
    container: Docker.ContainerInfo;
    isActive: boolean;
};
type Caching = {
    activeNodes: ContainerNode[];
};

@Injectable()
export class HydraMainService implements OnModuleInit {
    HYDRA_BIN_DIR_PATH = process.env.NEST_HYDRA_BIN_DIR_PATH || 'D:/Projects/Vtechcom/cardano-node/hydra/bin';

    private docker: Docker;
    private CONSTANTS = {
        cardanoNodeServiceName: process.env.NEST_CARDANO_NODE_SERVICE_NAME || 'cardano-node',
        cardanoNodeImage: process.env.NEST_CARDANO_NODE_IMAGE || 'ghcr.io/intersectmbo/cardano-node:10.1.4',
        cardanoNodeFolder: process.env.NEST_CARDANO_NODE_FOLDER || 'D:/Projects/Vtechcom/cardano-node',
        cardanoNodeSocketPath:
            process.env.NEST_CARDANO_NODE_SOCKET_PATH || 'D:/Projects/Vtechcom/cardano-node/node.socket',
        hydraNodeImage: process.env.NEST_HYDRA_NODE_IMAGE || 'ghcr.io/cardano-scaling/hydra-node:0.20.0',
        hydraNodeFolder: process.env.NEST_HYDRA_NODE_FOLDER || 'D:/Projects/Vtechcom/cardano-node/hydra/preprod',
        hydraNodeScriptTxId: process.env.NEST_HYDRA_NODE_SCRIPT_TX_ID || '',
        hydraNodeNetworkId: process.env.NEST_HYDRA_NODE_NETWORK_ID || '1',
        cardanoAccountMinLovelace: process.env.ACCOUNT_MINT_LOVELACE || 50000000, // 50 ADA
        enableNetworkHost: process.env.NEST_DOCKER_ENABLE_NETWORK_HOST === 'true',

        // Dockerize
        hydraPartyLabel: 'party_id',
        hydraNodeLabel: 'node_id',
        dockerSock: process.env.NEST_DOCKER_SOCKET_PATH || '\\\\.\\pipe\\docker_engine',
    };

    private cardanoNode = {
        container: null as Docker.Container | null,
        tip: {
            block: 0,
            epoch: 0,
            hash: '',
            slot: 0,
            slotInEpoch: 0,
            slotsToEpochEnd: 0,
            syncProgress: '0.00',
            ledgerTip: {
                id: '',
                slot: 0,
            },
            eraStart: {
                epoch: 0,
                slot: 0,
            },
        },
    };
    private logger = new Logger(HydraMainService.name);

    constructor(
        @InjectRepository(HydraNode)
        private hydraNodeRepository: Repository<HydraNode>,
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        @InjectRepository(HydraParty)
        private hydraPartyRepository: Repository<HydraParty>,
        // @InjectRepository(GameRoom)
        // private gameRoomRepository: Repository<GameRoom>,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,

        private ogmiosClientService: OgmiosClientService,
    ) {
        const DOCKER_SOCKET = process.env.NEST_DOCKER_SOCKET_PATH || '\\\\.\\pipe\\docker_engine';
        this.docker = new Docker({ socketPath: DOCKER_SOCKET });
    }

    async onModuleInit() {
        console.log('onModuleInit');
        console.log('[LOAD ENVs]', this.CONSTANTS);
        const listContainers = await this.docker.listContainers({ all: true });

        const cardanoNodeContainer = listContainers.find(
            container => container.Image === this.CONSTANTS.cardanoNodeImage,
        );
        if (cardanoNodeContainer && cardanoNodeContainer.State !== 'running') {
            console.log('Cardano node is not running');
            // delete node.socket to restart docker
            await this.docker.getContainer(cardanoNodeContainer.Id).restart();
            this.cardanoNode.container = this.docker.getContainer(cardanoNodeContainer.Id);
        } else if (!cardanoNodeContainer) {
            console.log('Cardano node is not running, try to run cardano-node');
            const container = await this.docker.createContainer({
                Image: this.CONSTANTS.cardanoNodeImage,
                name: this.CONSTANTS.cardanoNodeServiceName,
                HostConfig: {
                    Binds: [
                        `${this.CONSTANTS.cardanoNodeFolder}/database:/db`, // Map local ./database to /db
                        `${this.CONSTANTS.cardanoNodeFolder}:/workspace`, // Map local ./ to /workspace
                    ],
                    PortBindings: {
                        '8091/tcp': [{ HostPort: '8091' }], // Map port 8091
                    },
                    RestartPolicy: {
                        Name: 'always', // Equivalent to `restart: always`
                    },
                },
                Cmd: [
                    'run',
                    '--config',
                    '/workspace/config.json',
                    '--topology',
                    '/workspace/topology.json',
                    '--socket-path',
                    '/workspace/node.socket',
                    '--database-path',
                    '/db',
                    '--port',
                    '8091',
                    '--host-addr',
                    '0.0.0.0',
                ],
                ExposedPorts: {
                    '8091/tcp': {},
                },
            });

            // Start the container
            await container.start();
            this.cardanoNode.container = container;
        }
        this.cardanoNode.container = this.docker.getContainer(cardanoNodeContainer.Id);
        const output = await this.execInContainer(this.CONSTANTS.cardanoNodeServiceName, [
            'cardano-cli',
            'query',
            'tip',
            `--socket-path`,
            `/workspace/node.socket`,
            '--testnet-magic',
            '1',
        ]);
        this.logger.verbose('>>> / file: hydra-main.service.ts:121 / execInContainer:', output);
        this.updateHydraContainerStatus();
        try {
            const tip = await this.cardanoQueryTip();
            this.logger.log('>>> / file: hydra-main.service.ts:121 / tip:', tip);
            this.cardanoNode.tip = tip;
            await this.cacheManager.set('cardanoNodeTip', tip);
        } catch (err) {
            this.logger.error('Error parse json', err);
        }
        return;
    }

    @Cron('*/10 * * * * *')
    async updateHydraContainerStatus() {
        // Update hydra party status
        // Check container with "Name": "/hexcore-hydra-node-[ID]" that has running status
        // If all nodes are running, set party status to "ACTIVE"
        // Otherwise, set party status to "INACTIVE"
        this.docker
            .listContainers({ all: true })
            .then(containers => {
                const pattern = /hexcore-hydra-node-(\d+)/;
                const activeNodes = containers
                    .filter(container => {
                        return container.Names.find(name => pattern.test(name)) && container.State === 'running';
                    })
                    .map(node => {
                        return {
                            hydraNodeId: node.Labels[this.CONSTANTS.hydraNodeLabel],
                            hydraPartyId: node.Labels[this.CONSTANTS.hydraPartyLabel],
                            container: node,
                            isActive: node.State === 'running',
                        };
                    });
                this.cacheManager.set<Caching['activeNodes']>('activeNodes', activeNodes);
            })
            .catch(err => {
                this.logger.error('>>> / file: hydra-main.service.ts:217 / Error fetching active nodes:', err);
                this.cacheManager.set('activeNodes', []);
            });
    }

    async testOgmiosConnection() {
        return this.ogmiosClientService.test();
    }

    async getActiveNodeContainers() {
        const activeNodes = (await this.cacheManager.get<Caching['activeNodes']>('activeNodes')) || [];
        return activeNodes;
    }

    async cardanoQueryTip() {
        const tip = await this.ogmiosClientService.queryTip();
        return tip;
    }

    async getCardanoNodeInfo() {
        const tip = await this.ogmiosClientService.queryTip();
        const protocolParameters = await this.ogmiosClientService.getProtocolParameters();
        return {
            tip,
            protocolParameters,
        };
    }

    async getAddressUtxo(address: string): Promise<AddressUtxoDto> {
        try {
            const addrUTxOs = await this.ogmiosClientService.queryUtxoByAddress(address);
            const utxoObject = convertUtxoToUTxOObject(addrUTxOs);
            return utxoObject;
        } catch (err) {
            console.log(`[Error getAddressUtxo] [${address}] `, err);
            throw new BadRequestException('Error getAddressUtxo');
        }
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        await writeFileSync(filePath, content, {
            encoding: 'utf-8',
        });
    }

    async removeFile(filePath: string): Promise<void> {
        try {
            // check if file exists
            await access(filePath, constants.R_OK | constants.W_OK);
            await unlink(filePath);
        } catch (error: any) {
            console.error(`Error while removing file: ${filePath}`, error.message);
        }
    }

    async execInContainer(containerName: string, cmd: string[], workDir = '/') {
        try {
            // Find the container
            const container = this.docker.getContainer(containerName);

            // Create an exec instance
            const exec = await container.exec({
                Cmd: cmd,
                AttachStdout: true,
                AttachStderr: true,
                WorkingDir: workDir,
                AttachStdin: false,
            });

            // Start the exec instance and attach the output streams
            const stream = await exec.start({});

            // Capture the output
            return new Promise<string>((resolve, reject) => {
                const buffer: Buffer[] = [];

                stream.on('data', (chunk: Buffer) => {
                    buffer.push(chunk);
                });

                stream.on('end', () => {
                    resolve(Buffer.concat(buffer).toString());
                });

                stream.on('error', err => {
                    reject(err);
                });
            });
        } catch (error) {
            console.error('Error executing command in container:', error.message);
            throw error;
        }
    }

    cleanJSON(_jsonString: string) {
        let jsonString = _jsonString
            .replace(/^[\s\S]*?{/, '{')
            .replace(/^[^{]*\{\{/, '{') // Replace double {{
            .replace(/\}\}[^}]*$/, '}') // Replace double }} at end
            .replace(/^\uFFFD/, '') // remove replacement character at start
            .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '') // control characters
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2013\u2014]/g, '-')
            .replace(/\u00A0/g, ' ')
            .replace(/\u2026/g, '...')
            .replace(/^\uFFFD/, '')
            .replace(/[^\x20-\x7E]/g, '') // non-printable
            .trim();
        if (!jsonString.startsWith('{')) {
            jsonString = _jsonString.slice(1, jsonString.length);
        }
        return jsonString;
    }

    async getListAccount() {
        const accounts = (await this.accountRepository.find()) as Array<Account & { utxo: any }>;
        for (const account of accounts) {
            account.utxo = {};
        }
        return accounts.map(account => new ResCardanoAccountDto(account));
    }

    async createAccount(body: CreateAccountDto) {
        const baseAddress = getBaseAddressFromMnemonic(body.mnemonic);
        const baseAddressStr = baseAddress.to_address().to_bech32();

        const paymentSKey = getSigningKeyFromMnemonic(body.mnemonic);
        const paymentVkey = new PaymentVerificationKey(paymentSKey);
        const poiterAddress = paymentVkey.toPointerAddress(NetworkInfo.TESTNET_PREPROD).to_address().to_bech32();

        const existedAccount = await this.accountRepository.findOne({
            where: {
                mnemonic: body.mnemonic,
            },
        });
        if (existedAccount) {
            throw new BadRequestException('This account has exited');
        }

        const newAccount = this.accountRepository.create();
        newAccount.mnemonic = body.mnemonic;
        newAccount.baseAddress = baseAddressStr;
        newAccount.pointerAddress = poiterAddress;
        const result = await this.accountRepository.save(newAccount);
        return result;
    }

    async getListHydraNode({ pagination }: { pagination: IPaginationOptions }) {
        const nodes = await this.hydraNodeRepository.find({
            skip: (pagination.page - 1) * pagination.limit,
            take: pagination.limit,
            relations: {
                cardanoAccount: true,
            },
        });
        const activeNodes = await this.getActiveNodeContainers();
        return nodes.map(node => {
            // check node active
            const isActive = activeNodes.find(item => item.hydraNodeId === node.id.toString());

            return new HydraDto(node, isActive ? 'ACTIVE' : 'INACTIVE');
        });
    }

    async getHydraNodeById(id: number) {
        return this.hydraNodeRepository.findOne({
            where: { id },
        });
    }

    async getHydraNodeDetail(id: number) {
        const node = await this.hydraNodeRepository.findOne({
            where: { id },
            relations: {
                cardanoAccount: true,
            },
        });
        const activeNodes = await this.getActiveNodeContainers();
        if (!node) {
            throw new BadRequestException('Invalid Hydra Node Id');
        }
        const containerNode = activeNodes.find(item => item.hydraNodeId === node.id.toString());
        return {
            ...node,
            status: containerNode ? 'ACTIVE' : 'INACTIVE',
            container: containerNode?.container,
        };
    }

    async createHydraNode(body: CreateHydraNodeDto) {
        const cardanoAccount = await this.accountRepository.findOne({
            where: {
                id: body.fromAccountId,
            },
        });
        if (!cardanoAccount) {
            throw new BadRequestException('Invalid Cardano Account');
        }

        const { skey, vkey } = await this.genHydraKey();
        const newHydraNode = this.hydraNodeRepository.create();
        newHydraNode.cardanoAccount = cardanoAccount;
        newHydraNode.description = body.description;
        newHydraNode.skey = skey;
        newHydraNode.vkey = vkey;
        newHydraNode.port = await this.genValidPort();
        const result = await this.hydraNodeRepository.save(newHydraNode);
        return result;
    }

    async genHydraKey() {
        try {
            const containerVolume = '/data';

            // Run the container
            const container = await this.docker.createContainer({
                Image: this.CONSTANTS.hydraNodeImage,
                Cmd: ['gen-hydra-key', '--output-file', `${containerVolume}/_hydra-internal-key`],
                HostConfig: {
                    Binds: [`${this.CONSTANTS.hydraNodeFolder}:${containerVolume}`], // Bind mount
                },
            });

            // Start the container
            await container.start();

            // Wait for the container to finish
            const stream = await container.logs({ stdout: true, stderr: true, follow: true });
            stream.pipe(process.stdout);

            const status = await container.wait();
            console.log('Container exited with status:', status.StatusCode);
            let skey = '';
            let vkey = '';
            if (status.StatusCode === 0) {
                skey = await readFile(`${this.CONSTANTS.hydraNodeFolder}/_hydra-internal-key.sk`, {
                    encoding: 'utf-8',
                });
                vkey = await readFile(`${this.CONSTANTS.hydraNodeFolder}/_hydra-internal-key.vk`, {
                    encoding: 'utf-8',
                });
            }
            // Remove the container
            await container.remove();
            console.log('Container removed successfully.');
            return { skey: JSON.stringify(JSON.parse(skey)), vkey: JSON.stringify(JSON.parse(vkey)) };
        } catch (error) {
            console.log('>>> / file: hydra-main.service.ts:267 / error:', error);
            return null;
        }
    }

    async genValidPort() {
        const defaultPort = 10005;
        let port = defaultPort;

        while (!(await this.isPortAvailable(port)) || (await this.checkHydraNodePort(port))) {
            console.log('node port: ' + port);
            port++;
        }
        return port;
    }

    async checkHydraNodePort(port: number): Promise<boolean> {
        const nodeExits = await this.hydraNodeRepository.find({
            where: { port: port },
        });

        return nodeExits.length > 0;
    }

    /**
     * Check if a specific port is available.
     * @param port - The port to check.
     * @returns Promise<boolean> - True if available, false otherwise.
     */
    async isPortAvailable(port: number): Promise<boolean> {
        return new Promise(resolve => {
            const server = net.createServer();

            server.once('error', (err: any) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(false); // Port is in use
                } else {
                    resolve(false); // Other errors
                }
            });

            server.once('listening', () => {
                server.close();
                resolve(true); // Port is available
            });

            server.listen(port);
        });
    }

    async createHydraParty(body: CreatePartyDto) {
        // create a party
        const newParty = this.hydraPartyRepository.create();
        newParty.nodes = body.nodes;
        newParty.description = body.description;
        newParty.status = 'INACTIVE';
        // validate cardano accounts
        if (body.cardanoAccountIds.length !== body.nodes) {
            throw new BadRequestException('Invalid Cardano Account Ids, must be equal to nodes');
        }
        // check existed cardano accounts
        const [cardanoAccounts, count] = await this.accountRepository.findAndCount({
            where: {
                id: In(body.cardanoAccountIds),
            },
        });
        if (count !== body.nodes) {
            const invalidIds = body.cardanoAccountIds.filter(id => !cardanoAccounts.find(account => account.id === id));
            throw new BadRequestException('Invalid Cardano Account Ids: ' + invalidIds.join(','));
        }
        // save the party
        await this.hydraPartyRepository.save(newParty);
        // create nodes for the party
        const nodes = [];
        for (const cardanoAccount of cardanoAccounts) {
            const { skey, vkey } = await this.genHydraKey();
            const newHydraNode = this.hydraNodeRepository.create();
            newHydraNode.cardanoAccount = cardanoAccount;
            newHydraNode.description = `Generated by party ${newParty.id}`;
            newHydraNode.skey = skey;
            newHydraNode.vkey = vkey;
            newHydraNode.port = await this.genValidPort();
            newHydraNode.party = newParty;
            await this.hydraNodeRepository.save(newHydraNode);
            nodes.push({
                ...newHydraNode,
                cardanoAccount,
            });
        }

        // active GameRoom
        // await this.createGameRoom(newParty, false);

        return {
            ...newParty,
            nodes,
        };
    }

    async getListHydraParty() {
        const parties = await this.hydraPartyRepository
            .createQueryBuilder('party')
            .leftJoinAndSelect('party.hydraNodes', 'hydraNodes')
            .leftJoinAndSelect('hydraNodes.cardanoAccount', 'cardanoAccount')
            .getMany();
        const activeNodes = await this.getActiveNodeContainers();
        return parties.map(party => {
            const isActive =
                party.hydraNodes.length &&
                party.hydraNodes.every(hydraNode => {
                    return activeNodes.find(
                        item =>
                            item.hydraPartyId === party.id.toString() && item.hydraNodeId === hydraNode.id.toString(),
                    );
                });
            return {
                ...party,
                status: isActive ? 'ACTIVE' : 'INACTIVE',
            };
        });
    }

    async checkUtxoAccount(account: Account): Promise<boolean> {
        const a_utxo = await this.getAddressUtxo(account.pointerAddress);
        const totalLovelace = Object.values(a_utxo).reduce((sum, item) => sum + item.value.lovelace, 0);
        console.log(`[${account.pointerAddress}]:[${totalLovelace} lovelace]`);
        return totalLovelace >= this.CONSTANTS.cardanoAccountMinLovelace ? true : false;
    }

    async activeHydraParty(activePartyDto: ReqActivePartyDto): Promise<ResActivePartyDto> {
        const partyId = activePartyDto.id;
        const party = await this.hydraPartyRepository
            .createQueryBuilder('party')
            .where('party.id = :id', { id: partyId })
            .leftJoinAndSelect('party.hydraNodes', 'hydraNodes')
            .leftJoinAndSelect('hydraNodes.cardanoAccount', 'cardanoAccount')
            .getOne();

        if (!party) {
            throw new BadRequestException('Invalid Party Id');
        }
        // if (party.status === 'ACTIVE') {
        //     throw new BadRequestException('Party is already active');
        // }
        for (const node of party.hydraNodes) {
            const check = await this.checkUtxoAccount(node.cardanoAccount);
            if (!check) {
                throw new BadRequestException(node.cardanoAccount.pointerAddress + ' not enough lovelace');
            }
        }

        // create party dir
        // const partyDirPath = `${this.CONSTANTS.hydraNodeFolder}/party-${party.id}`;
        const partyDirPath = resolvePartyDirPath(party.id, this.CONSTANTS.hydraNodeFolder);
        try {
            await access(partyDirPath, constants.R_OK | constants.W_OK);
        } catch (error: any) {
            console.error(`Error while accessing party dir: ${partyDirPath}`, error.message);
            await mkdir(partyDirPath, { recursive: true });
            await chmodSync(partyDirPath, 0o775); // RWX cho owner & group
        }
        // generate protocol-parameters.json
        const cardanoCli = new CardanoCliJs({
            cliPath: `docker exec cardano-node cardano-cli`,
            dir: `/workspace`,
            era: '',
            network: '1',
            socketPath: '/workspace/node.socket',
            shelleyGenesis: '/workspace/shelley-genesis.json',
        });
        const output = await cardanoCli.runCommand({
            command: 'query',
            subcommand: 'protocol-parameters',
            parameters: [
                { name: 'socket-path', value: '/workspace/node.socket' },
                { name: 'testnet-magic', value: '1' },
            ],
        });
        const protocolParameters = JSON.parse(Buffer.from(output).toString());
        protocolParameters.txFeeFixed = 0;
        protocolParameters.txFeePerByte = 0;
        protocolParameters.executionUnitPrices.priceMemory = 0;
        protocolParameters.executionUnitPrices.priceSteps = 0;
        await this.writeFile(`${partyDirPath}/protocol-parameters.json`, JSON.stringify(protocolParameters));

        // create docker container for each node
        for (const node of party.hydraNodes) {
            const peerNodes = party.hydraNodes.filter(peerNode => peerNode.id !== node.id);
            const nodeName = this.getDockerContainerName(node);

            const skeyFilePath = `${partyDirPath}/${nodeName}.sk`;
            const vkeyFilePath = `${partyDirPath}/${nodeName}.vk`;
            const cardanoSkeyFilePath = `${partyDirPath}/${nodeName}.cardano.sk`;
            const cardanoVkeyFilePath = `${partyDirPath}/${nodeName}.cardano.vk`;

            const skey = JSON.parse(node.skey);
            const vkey = JSON.parse(node.vkey);
            const cardanoSigningKey = getSigningKeyFromMnemonic(node.cardanoAccount.mnemonic);
            const cardanoAccount = {
                skey: cardanoSigningKey,
                vkey: new PaymentVerificationKey(cardanoSigningKey),
                pointerAddress: new PaymentVerificationKey(cardanoSigningKey).toPointerAddress(1),
            };
            // create credentials files
            await this.writeFile(skeyFilePath, JSON.stringify(skey, null, 4));
            await this.writeFile(vkeyFilePath, JSON.stringify(vkey, null, 4));
            await this.writeFile(cardanoSkeyFilePath, cardanoAccount.skey.toJSON(null, 4));
            await this.writeFile(cardanoVkeyFilePath, cardanoAccount.vkey.toJSON(null, 4));

            // remove container if existed
            try {
                const existedContainer = await this.docker.getContainer(nodeName);
                if (existedContainer) {
                    if ((await existedContainer.inspect()).State.Running) {
                        await existedContainer.stop();
                        console.log(`Container ${nodeName} stopped`);
                    }
                    await existedContainer.remove();
                    console.log(`Container ${nodeName} removed`);
                }
            } catch (error: any) {
                console.error(`Error while removing container: ${nodeName}`, error.message);
            }

            const cleanArg = (str: string | number) =>
                String(str)
                    .replace(/[^\x20-\x7E]/g, '')
                    .trim();
            /**
             * NOTE:
             * - Cập nhật command run node cho Hydra v0.21.0
             * - Chuyển sang chế độ network custom brigde:
             * - Nếu chưa có custom bridge network: `docker network create --driver bridge hydra-network`
             * - Thêm advertise param
             */
            /**
             * NOTE:
             * - Cập nhật command run node cho Hydra v0.22.2
             * - Chuyển sang chế độ network custom brigde:
             * - Nếu chưa có custom bridge network: `docker network create --driver bridge hydra-network`
             * - Thêm advertise param
             */
            const peerNodeParams = peerNodes
                .map(peerNode => {
                    const nodeName = this.getDockerContainerName(peerNode);
                    return [
                        '--peer',
                        `${nodeName}:${peerNode.port + 1000}`,
                        `--hydra-verification-key`,
                        `/data/party-${party.id}/${nodeName}.vk`,
                        `--cardano-verification-key`,
                        `/data/party-${party.id}/${nodeName}.cardano.vk`,
                    ];
                })
                .flat();
            const container = await this.docker.createContainer({
                Image: this.CONSTANTS.hydraNodeImage,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                // prettier-ignore
                Cmd: [
                    '--node-id', `${nodeName}`,
                    '--listen', `0.0.0.0:${node.port + 1000}`,
                    '--advertise', `${nodeName}:${node.port + 1000}`, 
                    '--hydra-signing-key', `/data/party-${party.id}/${nodeName}.sk`,
                    '--persistence-dir', `/data/${resolvePersistenceDir(party.id, nodeName)}`,
                    '--api-host', '0.0.0.0',
                    '--api-port', `${node.port}`,
                    ...peerNodeParams,
                    '--cardano-signing-key', `/data/party-${party.id}/${nodeName}.cardano.sk`,
                    '--hydra-scripts-tx-id', `${this.CONSTANTS.hydraNodeScriptTxId}`,
                    '--persistence-rotate-after', '15000', // 15_000 seq

                    '--deposit-period', `120s`,
                    '--contestation-period', `60s`,
                    
                    '--testnet-magic', `${this.CONSTANTS.hydraNodeNetworkId}`,
                    '--node-socket', `/cardano-node/node.socket`,
                    '--ledger-protocol-parameters', `/data/party-${party.id}/protocol-parameters.json`,
                ],
                HostConfig: {
                    NetworkMode: 'hydra-network',
                    Binds: [
                        `${this.CONSTANTS.hydraNodeFolder}:/data`,
                        `${this.CONSTANTS.cardanoNodeFolder}:/cardano-node`,
                    ],
                    PortBindings: {
                        [`${node.port}/tcp`]: [{ HostPort: `${node.port}` }],
                        [`${node.port + 1000}/tcp`]: [{ HostPort: `${node.port + 1000}` }],
                    },
                },
                ExposedPorts: {
                    [`${node.port}/tcp`]: {},
                    [`${node.port + 1000}/tcp`]: {},
                },
                name: nodeName,
                Labels: {
                    [this.CONSTANTS.hydraPartyLabel]: party.id.toString(),
                    [this.CONSTANTS.hydraNodeLabel]: node.id.toString(),
                },
                Env: [
                    'ETCD_AUTO_COMPACTION_MODE=periodic',
                    'ETCD_AUTO_COMPACTION_RETENTION=168h',
                    // Giảm nhịp heartbeat, tăng timeout election để hạn chế lease drop
                    'ETCD_HEARTBEAT_INTERVAL=1000', // 1000ms
                    'ETCD_ELECTION_TIMEOUT=5000', // 5000ms
                ],
                User: `${process.getuid ? process.getuid() : ''}:${process.getgid ? process.getgid() : ''}`,
            });
            // @ts-ignore
            node.container = {
                id: container.id,
                name: nodeName,
                args: (await container.inspect()).Args,
                image: (await container.inspect()).Config.Image,
            };
            await container.start();
            console.log(`Container ${nodeName} started`);
        }
        // active GameRoom
        // await this.createGameRoom(party);
        // party.status = 'ACTIVE';
        await this.hydraPartyRepository.save(party);

        await Promise.resolve(() => setTimeout(() => {}, 1000));
        // check party active
        const status = await this.checkPartyActive(party);

        return {
            ...party,
            status: status ? 'ACTIVE' : 'INACTIVE',
        };
    }

    async deactiveHydraParty(activePartyDto: ReqActivePartyDto): Promise<ResActivePartyDto> {
        const partyId = activePartyDto.id;
        const party = await this.hydraPartyRepository
            .createQueryBuilder('party')
            .where('party.id = :id', { id: partyId })
            .leftJoinAndSelect('party.hydraNodes', 'hydraNodes')
            .leftJoinAndSelect('hydraNodes.cardanoAccount', 'cardanoAccount')
            .getOne();

        if (!party) {
            throw new BadRequestException('Invalid Party Id');
        }
        // if (party.status === 'INACTIVE') {
        //     throw new BadRequestException('Party is already inactive');
        // }
        for (const node of party.hydraNodes) {
            const nodeName = this.getDockerContainerName(node);
            try {
                const container = await this.docker.getContainer(nodeName);
                if (container) {
                    if ((await container.inspect()).State.Running) {
                        await container.stop();
                        console.log(`[deactiveHydraParty]: Container ${nodeName} stopped`);
                    }
                    await container.remove();
                    console.log(`[deactiveHydraParty]: Container ${nodeName} removed`);
                }
            } catch (error: any) {
                console.error(`Error while removing container: ${nodeName}`, error.message);
            }
        }
        await Promise.resolve(() => setTimeout(() => {}, 1000));
        await this.hydraPartyRepository.save(party);
        await this.updateHydraContainerStatus();

        // check party active
        const status = await this.checkPartyActive(party);

        return {
            ...party,
            status: status ? 'ACTIVE' : 'INACTIVE',
        };
    }

    async clearHydraPersistents(data: ReqClearPartyDataDto) {
        try {
            console.log('data.ids', data.ids);
            const partyIds = data.ids;
            const [parties, count] = await this.hydraPartyRepository
                .createQueryBuilder('party')
                .where('party.id IN (:...ids)', { ids: partyIds })
                .leftJoinAndSelect('party.hydraNodes', 'hydraNodes')
                .leftJoinAndSelect('hydraNodes.cardanoAccount', 'cardanoAccount')
                .getManyAndCount();

            if (!count || !parties) {
                throw new NotFoundException('Invalid Party Id');
            }
            // await access(partyDirPath, constants.R_OK | constants.W_OK);
            const removedDirs = [] as string[];
            const errors = [] as string[];
            for (const party of parties) {
                for (const node of party.hydraNodes) {
                    const persistenceDir = resolvePersistenceDir(
                        party.id,
                        resolveHydraNodeName(node.id),
                        this.CONSTANTS.hydraNodeFolder,
                    );
                    console.log('persistenceDir', persistenceDir);
                    try {
                        await access(persistenceDir, constants.R_OK | constants.W_OK);
                        await rm(persistenceDir, { recursive: true, force: true });
                        removedDirs.push(persistenceDir);
                    } catch (error) {
                        errors.push(error.message);
                    }
                }
            }
            return {
                removedDirs,
                errors,
                parties,
            };
        } catch (error: any) {
            console.log('error', error);
            // console.error(`Error while accessing party dir: ${partyDirPath}`, error.message);
            // await mkdir(partyDirPath, { recursive: true });
            return [];
        }
    }

    // async createGameRoom(partyObj: HydraParty, active_status = true) {
    //     const item = await this.gameRoomRepository.findOne({
    //         where: { party: { id: partyObj.id } },
    //     });
    //     if (item) {
    //         item.status = active_status ? 'ACTIVE' : 'INACTIVE';
    //         await this.gameRoomRepository.save(item);
    //     } else {
    //         const room = this.gameRoomRepository.create({
    //             party: partyObj,
    //             name: `Room ${partyObj.id}`,
    //             status: active_status ? 'ACTIVE' : 'INACTIVE',
    //         });
    //         this.gameRoomRepository.save(room);
    //     }
    // }

    async checkPartyActive(party: HydraParty) {
        const activeNodes = await this.getActiveNodeContainers();
        return (
            party.hydraNodes.length &&
            party.hydraNodes.every(node => {
                return activeNodes.find(
                    item => item.hydraPartyId === party.id.toString() && item.hydraNodeId === node.id.toString(),
                );
            })
        );
    }

    async checkPartyActiveById(partyId: HydraParty['id']) {
        const activeNodes = await this.getActiveNodeContainers();
        const party = await this.hydraPartyRepository
            .createQueryBuilder('party')
            .where('party.id = :id', { id: partyId })
            .leftJoinAndSelect('party.hydraNodes', 'hydraNodes')
            .getOne();
        if (!party) return false;
        console.log(party);
        return (
            party.hydraNodes.length &&
            party.hydraNodes.every(node => {
                return activeNodes.find(
                    item => item.hydraPartyId === party.id.toString() && item.hydraNodeId === node.id.toString(),
                );
            })
        );
    }

    getDockerContainerName(hydraNode: HydraNode) {
        return resolveHydraNodeName(hydraNode.id);
    }

    async commitToHydraNode(commitHydraDto: CommitHydraDto) {
        // find the party and node
        const partyId = commitHydraDto.partyId;
        const party = await this.hydraPartyRepository
            .createQueryBuilder('party')
            .where('party.id = :id', { id: partyId })
            .leftJoinAndSelect('party.hydraNodes', 'hydraNodes')
            .leftJoinAndSelect('hydraNodes.cardanoAccount', 'cardanoAccount')
            .getOne();
        if (!party) {
            throw new BadRequestException('Invalid Party Id');
        }
        const hydraNode = party.hydraNodes.find(node => node.id === commitHydraDto.hydraHeadId);
        if (!hydraNode) {
            throw new BadRequestException('Invalid Hydra Head Id');
        }
        const hydraNodeInfo = {
            protocol: 'http',
            host: 'localhost',
            port: hydraNode.port,
        };
        // commit utxo to node
        try {
            const rs = await axios({
                baseURL: `${hydraNodeInfo.protocol}://${hydraNodeInfo.host}:${hydraNodeInfo.port}`,
                url: '/commit',
                method: 'POST',
                data: {
                    ...commitHydraDto.utxo,
                },
            });
            if (rs.data && rs.status === 200) {
                return rs.data;
            }
            throw new BadRequestException('Got error when commit to head', {
                cause: "Get no data from '/commit",
            });
        } catch (err) {
            throw new BadRequestException('Got error when commit to head', { cause: err.response.data });
        }
    }

    async submitTxToHydraNode(submitBody: SubmitTxHydraDto) {
        // find the party and node
        const partyId = submitBody.partyId;
        const party = await this.hydraPartyRepository
            .createQueryBuilder('party')
            .where('party.id = :id', { id: partyId })
            .leftJoinAndSelect('party.hydraNodes', 'hydraNodes')
            .leftJoinAndSelect('hydraNodes.cardanoAccount', 'cardanoAccount')
            .getOne();
        if (!party) {
            throw new BadRequestException('Invalid Party Id');
        }
        const hydraNode = party.hydraNodes.find(node => node.id === submitBody.hydraHeadId);
        if (!hydraNode) {
            throw new BadRequestException('Invalid Hydra Head Id');
        }
        const hydraNodeInfo = {
            protocol: 'http',
            host: 'localhost',
            port: hydraNode.port,
        };
        // submit utxo to node
        try {
            const rs = await axios({
                baseURL: `${hydraNodeInfo.protocol}://${hydraNodeInfo.host}:${hydraNodeInfo.port}`,
                url: '/cardano-transaction',
                method: 'POST',
                data: {
                    ...submitBody.transaction,
                },
            });
            if (rs.data && rs.status === 200) {
                return rs.data;
            }
            throw new BadRequestException('Got error when commit to head');
        } catch (err) {
            console.log('/cardano-transaction', err.response);
            throw new BadRequestException('Got error when commit to head');
        }
    }
}
