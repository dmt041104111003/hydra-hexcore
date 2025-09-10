import { Native, Plutus, Utxo } from '@cardano-ogmios/schema';
import { ReferenceScript, UTxOObject, UTxOObjectValue } from '../dto/response/address-utxo.dto';

import { CardanoWASM } from '@hydra-sdk/cardano-wasm';
import { convertBigIntToString } from 'src/utils/bigint.utils';

export const convertUtxoToUTxOObject = (utxos: Utxo): UTxOObject => {
    try {
        const utxoObject: UTxOObject = {};
        for (const utxo of utxos) {
            const txHash = `${utxo.transaction.id}#${utxo.index}`;
            if (!utxoObject[txHash]) {
                utxoObject[txHash] = {};
            }
            const lovelace = utxo.value.ada.lovelace.toString();
            delete utxo.value.ada;
            const referenceScript = convertReferenceScript(utxo.script);

            const datumHash = utxo.datumHash || null;

            const inlineDatumRaw = utxo.datum || null;
            const plutusData = inlineDatumRaw ? CardanoWASM.PlutusData.from_hex(inlineDatumRaw) : null;
            const inlineDatum = plutusData ? plutusData.to_json(CardanoWASM.PlutusDatumSchema.DetailedSchema) : null;

            // Nếu không có datum mà chỉ có datumHash thì inlineDatumhash = null
            const inlineDatumHash = plutusData ? CardanoWASM.hash_plutus_data(plutusData).to_hex() : null;

            utxoObject[txHash] = {
                address: utxo.address,
                value: {
                    lovelace,
                    ...convertBigIntToString(utxo.value),
                },
                datum: null,
                datumhash: datumHash,

                inlineDatumhash: inlineDatumHash,
                inlineDatumRaw: inlineDatumRaw,
                inlineDatum: JSON.parse(inlineDatum),

                referenceScript,
            } as UTxOObjectValue;
        }
        return utxoObject;
    } catch (error) {
        console.error('Error converting UTxO to UTxOObject:', error);
        throw error;
    }
};

export const convertReferenceScript = (script: Native | Plutus | null | undefined): ReferenceScript | null => {
    if (!script) return null;

    const { language, cbor } = script;

    if (language === 'native') {
        const { json, language, cbor } = script as Native;
        return {
            scriptLanguage: language,
            script: {
                type: 'SimpleScript',
                description: JSON.stringify(json),
                cborHex: cbor,
            },
        };
    } else if (language === 'plutus:v1' || language === 'plutus:v2' || language === 'plutus:v3') {
        const { cbor, language } = script as Plutus;
        const type =
            language === 'plutus:v1'
                ? 'PlutusScriptV1'
                : language === 'plutus:v2'
                  ? 'PlutusScriptV2'
                  : 'PlutusScriptV3';
        return {
            scriptLanguage: language,
            script: {
                type,
                description: '',
                cborHex: cbor,
            },
        };
    }

    return null;
};
