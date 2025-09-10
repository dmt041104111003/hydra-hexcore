import { Injectable, Logger, OnModuleInit, OnModuleDestroy, BadRequestException } from '@nestjs/common';
import {
    Connection,
    createConnectionObject,
    createLedgerStateQueryClient,
    getServerHealth,
    InteractionContext,
    LedgerStateQuery,
    createInteractionContext,
} from '@cardano-ogmios/client';
import { Point } from '@cardano-ogmios/schema';

import { ConfigService } from '@nestjs/config';
import { LedgerStateQueryClient } from '@cardano-ogmios/client/dist/LedgerStateQuery';
import { convertBigIntToString, safeStringify } from '../utils/bigint.utils';

@Injectable()
export class OgmiosClientService implements OnModuleInit, OnModuleDestroy {
    private connection: Connection;
    private interactionContext: InteractionContext | null = null;
    private ledgerStateClient: LedgerStateQueryClient | null = null;
    private logger = new Logger(OgmiosClientService.name);
    private isConnected: boolean = false;

    constructor(private configService: ConfigService) {
        this.logger.log('Ogmios client service instantiated');
        const NEST_OGMIOS_PORT = this.configService.get('NEST_OGMIOS_PORT');
        this.connection = createConnectionObject({
            host: this.configService.get('NEST_OGMIOS_HOST') || 'localhost',
            port: ['443', '80'].includes(NEST_OGMIOS_PORT) ? undefined : NEST_OGMIOS_PORT,
            tls: false,
        });
    }

    async onModuleInit() {
        try {
            await this.connect();
            this.logger.log('Ogmios client initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Ogmios client:', error);
        }
    }

    async onModuleDestroy() {
        await this.disconnect();
    }

    private async connect(): Promise<void> {
        if (this.isConnected) {
            return;
        }

        try {
            // Create interaction context which establishes the WebSocket connection
            this.interactionContext = await createInteractionContext(
                error => {
                    this.logger.error('Ogmios connection error:', error);
                    this.isConnected = false;
                },
                (code, reason) => {
                    this.logger.warn(`Ogmios connection closed: ${code} - ${reason}`);
                    this.isConnected = false;
                },
                { connection: this.connection },
            );

            // Create ledger state client using the interaction context
            this.ledgerStateClient = await createLedgerStateQueryClient(this.interactionContext);
            this.isConnected = true;

            this.logger.log('Ogmios client connected');
        } catch (error) {
            this.logger.error('Failed to connect to Ogmios:', error);
            throw error;
        }
    }

    private async disconnect(): Promise<void> {
        if (this.interactionContext && this.interactionContext.socket) {
            this.interactionContext.socket.close();
            this.interactionContext = null;
            this.ledgerStateClient = null;
            this.isConnected = false;
            this.logger.log('Ogmios client disconnected');
        }
    }

    private async ensureConnected(): Promise<void> {
        if (!this.isConnected || !this.interactionContext) {
            await this.connect();
        }
    }

    async test() {
        try {
            // Ensure we have a valid connection
            await this.ensureConnected();

            if (!this.interactionContext) {
                throw new Error('No interaction context available');
            }

            // Test server health first
            const health = await getServerHealth({ connection: this.connection });
            this.logger.log('Ogmios server health:', health);

            // Query protocol parameters
            const query = await LedgerStateQuery.protocolParameters(this.interactionContext);

            // Convert BigInt values to strings for logging
            const sanitizedQuery = convertBigIntToString(query);
            console.log('>>> Protocol parameters query successful:', safeStringify(sanitizedQuery, 2));

            return sanitizedQuery;
        } catch (error) {
            console.error('>>> Ogmios test error:', error);
            this.logger.error('Ogmios test failed:', error);
            throw error;
        }
    }

    async getProtocolParameters() {
        await this.ensureConnected();
        if (!this.interactionContext) {
            throw new Error('No interaction context available');
        }

        const result = await LedgerStateQuery.protocolParameters(this.interactionContext);
        // Convert BigInt to strings for safe JSON serialization
        return convertBigIntToString(result);
    }

    async getRawProtocolParameters() {
        await this.ensureConnected();
        if (!this.interactionContext) {
            throw new Error('No interaction context available');
        }
        // Return raw result with BigInt values intact
        return await LedgerStateQuery.protocolParameters(this.interactionContext);
    }

    async isHealthy(): Promise<boolean> {
        try {
            const health = await getServerHealth({ connection: this.connection });
            return !!health;
        } catch (error) {
            this.logger.error('Health check failed:', error);
            return false;
        }
    }

    async queryTip() {
        await this.ensureConnected();
        if (!this.interactionContext) {
            throw new Error('No interaction context available');
        }

        try {
            const epoch = await LedgerStateQuery.epoch(this.interactionContext);
            const eraStart = await LedgerStateQuery.eraStart(this.interactionContext);
            const networkBlockHeight = await LedgerStateQuery.networkBlockHeight(this.interactionContext);
            const ledgerTip = (await LedgerStateQuery.ledgerTip(this.interactionContext)) as Point;
            const networkTip = (await LedgerStateQuery.networkTip(this.interactionContext)) as Point;

            const slotPerEpoch = 432000; // This should ideally be fetched from protocol parameters
            const slotInEpoch = networkTip.slot - ((epoch - eraStart.epoch) * slotPerEpoch + eraStart.slot);
            const slotsToEpochEnd = slotPerEpoch - slotInEpoch;

            const syncProgress =
                ledgerTip.slot && networkTip.slot ? ((networkTip.slot / ledgerTip.slot) * 100).toFixed(2) : '0.00';
            return {
                block: networkBlockHeight as number,
                epoch,
                hash: networkTip.id,
                slot: networkTip.slot,
                slotInEpoch,
                slotsToEpochEnd,
                syncProgress,
                ledgerTip: {
                    id: ledgerTip.id,
                    slot: ledgerTip.slot,
                },
                eraStart: {
                    epoch: eraStart.epoch,
                    slot: eraStart.slot,
                },
            };
        } catch (error) {
            this.logger.error('Failed to get current tip:', error);
            return null;
        }
    }

    async queryUtxo({ addresses, txHashes }: { addresses?: string[]; txHashes?: `${string}#${number}`[] }) {
        await this.ensureConnected();
        if (!this.interactionContext) {
            throw new Error('No interaction context available');
        }

        try {
            if (!addresses && !txHashes) {
                throw new Error('At least one of address or txHash must be provided');
            }

            const outputReferences = (txHashes || []).map(txHash => {
                const [txId, indexStr] = txHash.split('#');
                const index = parseInt(indexStr, 10);
                if (isNaN(index)) {
                    throw new Error(`Invalid txHash format: ${txHash}. Expected format is txHash#index`);
                }
                return { index, transaction: { id: txId } };
            });

            const utxo = await LedgerStateQuery.utxo(this.interactionContext, {
                addresses: addresses || [],
                ...(outputReferences.length ? { outputReferences } : {}),
            });
            return utxo;
        } catch (error) {
            this.logger.error(`Failed to query UTxO:`, error);
            throw new BadRequestException({ message: 'Failed to query UTxO', trace: JSON.stringify(error) });
        }
    }

    async queryUtxoByAddress(address: string) {
        return this.queryUtxo({ addresses: [address] });
    }
}
