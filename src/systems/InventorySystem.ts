/** An inventory slot holding an item stack. */
export interface Slot {
  itemId: string;
  quantity: number;
}

/** Slot-based inventory with optional stacking and overflow support. */
export class InventorySystem {
  private slots: (Slot | null)[];
  private maxSlots: number;
  readonly stacked: boolean;
  private overflow: Slot[];

  constructor(maxSlots: number = 16, stacked: boolean = true) {
    this.maxSlots = maxSlots;
    this.stacked = stacked;
    this.slots = new Array(maxSlots).fill(null);
    this.overflow = [];
  }

  /** Add items. Returns remaining quantity that couldn't fit (0 if all placed). */
  addItem(itemId: string, quantity: number = 1): number {
    if (this.stacked) {
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

    for (let i = 0; i < quantity; i++) {
      const emptyIdx = this.slots.findIndex(s => s === null);
      if (emptyIdx === -1) {
        this.overflow.push({ itemId, quantity: 1 });
      } else {
        this.slots[emptyIdx] = { itemId, quantity: 1 };
      }
    }
    return 0;
  }

  /** Remove up to `quantity` of an item. Returns true if the full amount was removed. */
  removeItem(itemId: string, quantity: number = 1): boolean {
    let remaining = quantity;

    if (this.stacked) {
      for (let i = this.slots.length - 1; i >= 0 && remaining > 0; i--) {
        const slot = this.slots[i];
        if (slot && slot.itemId === itemId) {
          const toRemove = Math.min(slot.quantity, remaining);
          slot.quantity -= toRemove;
          remaining -= toRemove;
          if (slot.quantity <= 0) this.slots[i] = null;
        }
      }
    } else {
      for (let i = 0; i < this.slots.length && remaining > 0; i++) {
        const slot = this.slots[i];
        if (slot && slot.itemId === itemId) {
          this.slots[i] = null;
          remaining--;
          if (this.overflow.length > 0) {
            const promoted = this.overflow.shift()!;
            this.slots[i] = promoted;
          }
        }
      }
      if (remaining > 0) {
        for (let i = 0; i < this.overflow.length && remaining > 0; i++) {
          if (this.overflow[i].itemId === itemId) {
            this.overflow[i].quantity--;
            remaining--;
            if (this.overflow[i].quantity <= 0) {
              this.overflow.splice(i, 1);
              i--;
            }
          }
        }
      }
    }

    return remaining === 0;
  }

  /** Remove an entire slot by index. Promotes from overflow if available. */
  removeSlot(index: number): boolean {
    if (index < 0 || index >= this.slots.length) return false;
    if (!this.slots[index]) return false;
    this.slots[index] = null;
    if (this.overflow.length > 0) {
      const promoted = this.overflow.shift()!;
      this.slots[index] = promoted;
    }
    return true;
  }

  /** Whether overflow items exist (capacity exceeded). */
  overCapacity(): boolean {
    return this.overflow.length > 0;
  }

  /** Number of filled slots. */
  capacityUsed(): number {
    return this.slots.filter(s => s !== null).length;
  }

  /** Maximum number of slots. */
  capacityMax(): number {
    return this.maxSlots;
  }

  /** Total quantity of a given item across all slots and overflow. */
  count(itemId: string): number {
    let total = this.slots.reduce((sum, slot) => {
      return slot && slot.itemId === itemId ? sum + slot.quantity : sum;
    }, 0);
    total += this.overflow.reduce((sum, slot) => {
      return slot.itemId === itemId ? sum + slot.quantity : sum;
    }, 0);
    return total;
  }

  /** Whether the inventory contains at least 1 of the given item. */
  has(itemId: string): boolean {
    return this.count(itemId) > 0;
  }

  /** Whether every slot is occupied. */
  isFull(): boolean {
    return this.slots.every(slot => slot !== null);
  }

  /** Get all items including overflow (null for empty slots). */
  getItems(): (Slot | null)[] {
    const all = [...this.slots];
    for (const o of this.overflow) {
      const idx = all.findIndex(s => s === null);
      if (idx !== -1) {
        all[idx] = { ...o };
      } else {
        all.push({ ...o });
      }
    }
    return all;
  }

  /** Increase maximum slot count (from research upgrades, relics, etc.). */
  expandSlots(additional: number): void {
    this.maxSlots += additional;
    this.slots.push(...new Array(additional).fill(null));
  }
}
