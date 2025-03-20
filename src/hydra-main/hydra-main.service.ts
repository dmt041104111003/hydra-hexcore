import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HydraNode } from './entities/HydraNode.entity';
import { In, Repository } from 'typeorm';
import { writeFileSync } from 'node:fs';
import { access, constants, readFile, unlink, mkdir } from 'node:fs/promises';
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
import { WalletServer } from 'cardano-wallet-js';
import { ResActivePartyDto } from './dto/response/active-party.dto';
import { CommitHydraDto } from './dto/request/commit-hydra.dto';
import axios from 'axios';
import { SubmitTxHydraDto } from './dto/request/submit-tx-hydra.dto';
import { AddressUtxoDto } from './dto/response/address-utxo.dto';
import { log } from 'node:console';

import { GameRoom } from '../hydra-game/entities/Room.entity';
import { CreateRoomDto } from '../hydra-game/dto/create-room.dto';

@Injectable()
export class HydraMainService implements OnModuleInit {
  HYDRA_BIN_DIR_PATH =
    process.env.NEST_HYDRA_BIN_DIR_PATH || 'D:/Projects/Vtechcom/cardano-node/hydra/bin';

  private docker: Docker;
  private CONSTANTS = {
    cardanoNodeServiceName: process.env.NEST_CARDANO_NODE_SERVICE_NAME || 'cardano-node',
    cardanoNodeImage:
      process.env.NEST_CARDANO_NODE_IMAGE || 'ghcr.io/intersectmbo/cardano-node:10.1.4',
    cardanoNodeFolder: process.env.NEST_CARDANO_NODE_FOLDER || 'D:/Projects/Vtechcom/cardano-node',
    cardanoNodeSocketPath:
      process.env.NEST_CARDANO_NODE_SOCKER_PATH || 'D:/Projects/Vtechcom/cardano-node/node.socket',
    hydraNodeImage:
      process.env.NEST_HYDRA_NODE_IMAGE || 'ghcr.io/cardano-scaling/hydra-node:0.20.0',
    hydraNodeFolder:
      process.env.NEST_HYDRA_NODE_FOLDER || 'D:/Projects/Vtechcom/cardano-node/hydra/preprod',
    hydraNodeScriptTxId:
      '5237b67923bf67e6691a09117c45fdc26c27911a8e2469d6a063a78da1c7c60a,5ed4032823e295b542d0cde0c5e531ca17c9834947400c05a50549607dbc3fa5,128af7ef4fd3fa8d1eda5cb1628aa2a1e8846d7685d91e0c6dae50b7d5f263b2',
  };

  private cardanoNode = {
    container: null as Docker.Container | null,
    tip: {
      block: 0,
      epoch: 0,
      era: 'Babbage',
      hash: '',
      slot: 0,
      slotInEpoch: 0,
      slotsToEpochEnd: 0,
      syncProgress: '0.00',
    },
  };

  private walletServer = WalletServer.init('https://dev.cardano-wallet.hdev99.io.vn/v2');

  constructor(
    @InjectRepository(HydraNode)
    private hydraNodeRepository: Repository<HydraNode>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(HydraParty)
    private hydraPartyRepository: Repository<HydraParty>,
    @InjectRepository(GameRoom)
    private gameRoomRepository: Repository<GameRoom>,
  ) {
    const DOCKER_SOCKET = process.env.NEST_DOCKER_SOCKET_PATH || '\\\\.\\pipe\\docker_engine';
    this.docker = new Docker({ socketPath: DOCKER_SOCKET });
  }

  async onModuleInit() {
    console.log('onModuleInit');
    console.log('[LOAD ENVs]', this.CONSTANTS);
    const listContainers = await this.docker.listContainers({ all: true });

    const cardanoNodeContainer = listContainers.find(
      (container) => container.Image === this.CONSTANTS.cardanoNodeImage,
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
    console.log('>>> / file: hydra-main.service.ts:109 / output:', output);

    try {
      const tip = JSON.parse(this.cleanJSON(output));
      console.log('>>> / file: hydra-main.service.ts:121 / tip:', tip);
      this.cardanoNode.tip = tip;
    } catch (err) {
      console.log(`Error parse json`, err);
    }

    return;
  }

  async cardanoQueryTip() {
    const output = await this.execInContainer(this.CONSTANTS.cardanoNodeServiceName, [
      'cardano-cli',
      'query',
      'tip',
      `--socket-path`,
      `/workspace/node.socket`,
      '--testnet-magic',
      '1',
    ]);
    try {
      const tip = JSON.parse(this.cleanJSON(output));
      this.cardanoNode.tip = tip;
    } catch (err) {
      console.log(`Error parse json`, err);
    }
    return this.cardanoNode.tip;
  }

  async getCardanoNodeInfo() {
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
    await this.cardanoQueryTip();
    return {
      tip: this.cardanoNode.tip,
      protocolParameters,
    };
  }

  async cardanoCliQueryUtxo(address: string) {
    const output = await this.execInContainer(this.CONSTANTS.cardanoNodeServiceName, [
      'cardano-cli',
      'query',
      'utxo',
      `--address`,
      `${address}`,
      `--socket-path`,
      `/workspace/node.socket`,
      '--testnet-magic',
      '1',
      '--output-json',
    ]);
    try {
      const data = JSON.parse(this.cleanJSON(output));
      return data as Record<string, any>;
    } catch (err) {
      console.log(`[Error parse json] [${output}] `, err);
      return {};
    }
  }

  async getAddressUtxo(address: string) {
    const utxo = await this.cardanoCliQueryUtxo(address);
    return utxo as AddressUtxoDto;
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

        stream.on('error', (err) => {
          reject(err);
        });
      });
    } catch (error) {
      console.error('Error executing command in container:', error.message);
      throw error;
    }
  }

  cleanJSON(jsonString: string) {
    const trimFirstRegex = /^[^[{]*\{/;
    return (
      jsonString
        .replace(trimFirstRegex, '{')
        // Remove invisible control characters and unused code points
        .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
        // Replace special quotation marks with standard ones
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        // Replace other common problematic characters
        .replace(/[\u2013\u2014]/g, '-') // Em and en dashes
        .replace(/\u00A0/g, ' ') // Non-breaking space
        .replace(/\u2026/g, '...')
        .replace(/^\uFFFD/, '') // Remove replacement character at start
        .replace(/[^\x20-\x7E]/g, '') // Remove any other non-printable characters
        .trim()
    ); // Ellipsis
  }

  async getListAccount() {
    const accounts = (await this.accountRepository.find()) as Array<Account & { utxo: any }>;
    for (const account of accounts) {
      account.utxo = await this.cardanoCliQueryUtxo(account.pointerAddress);
    }
    return accounts.map((account) => new ResCardanoAccountDto(account));
  }

  async createAccount(body: CreateAccountDto) {
    const baseAddress = getBaseAddressFromMnemonic(body.mnemonic);
    const baseAddressStr = baseAddress.to_address().to_bech32();

    const paymentSKey = getSigningKeyFromMnemonic(body.mnemonic);
    const paymentVkey = new PaymentVerificationKey(paymentSKey);
    const poiterAddress = paymentVkey
      .toPointerAddress(NetworkInfo.TESTNET_PREPROD)
      .to_address()
      .to_bech32();

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
        Image: 'ghcr.io/input-output-hk/hydra-node:latest',
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
      console.log("node port: " + port)
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
    return new Promise((resolve) => {
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
      const invalidIds = body.cardanoAccountIds.filter(
        (id) => !cardanoAccounts.find((account) => account.id === id),
      );
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
    await this.createGameRoom(newParty, false)

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
    return parties;
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
    if (party.status === 'ACTIVE') {
      throw new BadRequestException('Party is already active');
    }

    // create party dir
    const partyDirPath = `${this.CONSTANTS.hydraNodeFolder}/party-${party.id}`;
    try {
      await access(partyDirPath, constants.R_OK | constants.W_OK);
    } catch (error: any) {
      console.error(`Error while accessing party dir: ${partyDirPath}`, error.message);
      await mkdir(partyDirPath, { recursive: true });
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
    await this.writeFile(
      `${partyDirPath}/protocol-parameters.json`,
      JSON.stringify(protocolParameters),
    );

    // create docker container for each node
    for (const node of party.hydraNodes) {
      const peerNodes = party.hydraNodes.filter((peerNode) => peerNode.id !== node.id);
      const nodeName = `hexcore-hydra-node-${node.id}`;

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

      const peerNodeParams = peerNodes
        .map((peerNode) => {
          const nodeName = `hexcore-hydra-node-${peerNode.id}`;
          return [
            '--peer',
            `127.0.0.1:${peerNode.port + 1000}`,
            `--hydra-verification-key`,
            `/data/party-${party.id}/${nodeName}.vk`,
            `--cardano-verification-key`,
            `/data/party-${party.id}/${nodeName}.cardano.vk`,
          ];
        })
        .flat();
      const container = await this.docker.createContainer({
        Image: this.CONSTANTS.hydraNodeImage,
        Cmd: [
          '--node-id',
          `${nodeName}`,

          `--persistence-dir`,
          `/data/party-${party.id}/persistence-${nodeName}`,

          `--api-port`,
          `${node.port}`,

          `--api-host`,
          `0.0.0.0`,

          '--port',
          `${node.port + 1000}`,

          '--host',
          '0.0.0.0',

          ...peerNodeParams,

          `--hydra-signing-key`,
          `/data/party-${party.id}/${nodeName}.sk`,
          `--cardano-signing-key`,
          `/data/party-${party.id}/${nodeName}.cardano.sk`,

          `--ledger-protocol-parameters`,
          `/data/party-${party.id}/protocol-parameters.json`,

          `--hydra-scripts-tx-id`,
          `${this.CONSTANTS.hydraNodeScriptTxId}`,

          `--node-socket`,
          `/cardano-node/node.socket`,

          `--testnet-magic`,
          `1`,
        ],
        HostConfig: {
          Binds: [
            `${this.CONSTANTS.hydraNodeFolder}:/data`,
            `${this.CONSTANTS.cardanoNodeFolder}:/cardano-node`,
          ], // Bind mount
          RestartPolicy: {
            Name: 'always', // Equivalent to `restart: always`
          },
          PortBindings: {
            [`${node.port}/tcp`]: [{ HostPort: `${node.port}` }], // Map api port
            [`${node.port + 1000}/tcp`]: [{ HostPort: `${node.port + 1000}` }], // Map port
          },
        },
        ExposedPorts: {
          [`${node.port}/tcp`]: {},
          [`${node.port + 1000}/tcp`]: {},
        },
        name: nodeName,
        // Create name Room/Hydra Party for node
        Labels: {
          party_name: `party-${party.id.toString()}`,
          party_id: party.id.toString(),
        },
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
    await this.createGameRoom(party)

    // check party active
    const status = await this.checkPartyActive(party);

    return {
      ...party,
      status: status ? 'ACTIVE' : 'INACTIVE',
    };
  }

  async createGameRoom(partyObj: HydraParty, active_status = true) {
    const item = await this.gameRoomRepository.findOne({
      where: { party: { id: partyObj.id } },
    });
    if (item) {
      item.status = active_status ? "ACTIVE" : "INACTIVE"
      await this.gameRoomRepository.save(item);
    }
    else {
      const room = this.gameRoomRepository.create({
        party: partyObj,
        name: `Room ${partyObj.id}`,
        status: active_status ? "ACTIVE" : "INACTIVE"
      });
      this.gameRoomRepository.save(room);
    }
  }

  checkPartyActive(party: HydraParty) {
    for (const node of party.hydraNodes) {
      console.log('>>> / file: hydra-main.service.ts:607 / node:', node);

      // check if the node is active
      // if not, return false
    }
    return false;
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
    const hydraNode = party.hydraNodes.find((node) => node.id === commitHydraDto.hydraHeadId);
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
    const hydraNode = party.hydraNodes.find((node) => node.id === submitBody.hydraHeadId);
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
