export interface Slot {
  itemId: string;
  quantity: number;
}

export class InventorySystem {
  private slots: (Slot | null)[];
  private maxSlots: number;

  constructor(maxSlots: number = 16) {
    this.maxSlots = maxSlots;
    this.slots = new Array(maxSlots).fill(null);
  }

  addItem(itemId: string, quantity: number = 1): number {
    let remaining = quantity;

    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const slot = this.slots[i];
      if (slot && slot.itemId === itemId) {
        slot.quantity += remaining;
        remaining = 0;
      } else if (!slot) {
        this.slots[i] = { itemId, quantity: remaining };
        remaining = 0;
      }
    }

    return remaining;
  }

  removeItem(itemId: string, quantity: number = 1): boolean {
    let remaining = quantity;

    for (let i = this.slots.length - 1; i >= 0 && remaining > 0; i--) {
      const slot = this.slots[i];
      if (slot && slot.itemId === itemId) {
        const toRemove = Math.min(slot.quantity, remaining);
        slot.quantity -= toRemove;
        remaining -= toRemove;
        if (slot.quantity <= 0) this.slots[i] = null;
      }
    }

    return remaining === 0;
  }

  count(itemId: string): number {
    return this.slots.reduce((sum, slot) => {
      return slot && slot.itemId === itemId ? sum + slot.quantity : sum;
    }, 0);
  }

  isFull(): boolean {
    return this.slots.every(slot => slot !== null);
  }

  getItems(): (Slot | null)[] {
    return [...this.slots];
  }

  expandSlots(additional: number): void {
    this.maxSlots += additional;
    this.slots.push(...new Array(additional).fill(null));
  }
}
