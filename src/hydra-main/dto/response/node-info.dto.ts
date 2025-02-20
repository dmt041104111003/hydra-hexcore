export class CardanoNodeInfoDto {
  block: number;
  epoch: number;
  era: string;
  hash: string;
  slot: number;
  slotInEpoch: number;
  slotsToEpochEnd: number;
  syncProgress: string;
}
