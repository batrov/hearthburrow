export type ExtractionType = 'safe' | 'emergency';

export interface ExtractionResult {
  type: ExtractionType;
  itemsLost: number;
  successful: boolean;
}

export class ExtractionSystem {
  safeExtract(): ExtractionResult {
    return { type: 'safe', itemsLost: 0, successful: true };
  }

  emergencyExtract(inventorySize: number): ExtractionResult {
    const itemsLost = Math.floor(inventorySize * 0.3);
    return { type: 'emergency', itemsLost, successful: true };
  }
}
