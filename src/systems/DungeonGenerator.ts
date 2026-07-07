import Phaser from 'phaser';
import { gameState } from './GameState';

const BIOME_NAMES = ['FOREST', 'CAVE', 'ICE', 'LAVA', 'RUINS'];

function getBiomeKey(depth: number): string {
  return BIOME_NAMES[Math.floor(depth / 5) % 5];
}

export type TileType = 'wall' | 'floor' | 'mineable' | 'stairs_up' | 'stairs_down' | 'corridor'
  | 'event_chest' | 'event_merchant' | 'event_goblin' | 'event_villager' | 'event_fountain'
  | 'event_shop'
  | 'event_treasure_vault'
  | 'event_relic'
  | 'enemy' | 'event_boss'
  | 'pressure_plate' | 'blocked' | 'boss_body'
  | 'carrot_pickup'
  | 'secret_stair'
  | 'secret_npc'
  | 'decoration';

export interface DungeonTile {
  type: TileType;
  resource: string;
  durability: number;
  maxDurability: number;
  broken: boolean;
  eventId: string;
  pressurePlateTarget?: { x: number; y: number };
}

export interface DungeonFloor {
  tiles: DungeonTile[][];
  cols: number;
  rows: number;
  entryX: number;
  entryY: number;
  stairsDownX: number;
  stairsDownY: number;
  depth: number;
  initialMineableCount: number;
  mineableCount: number;
  puzzle?: { totalPlates: number; pressedPlates: number; room: { x: number; y: number; w: number; h: number } };
  isSecretRoom?: boolean;
  isDarknessLifted?: boolean;
  hermitGreeted?: boolean;
  interactedDecorations: Set<number>;
}

interface RoomRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EVENT_POOL: { type: TileType; eventId: string }[] = [
  { type: 'event_chest', eventId: 'hidden_treasure' },
  { type: 'event_fountain', eventId: 'blessing_fountain' },
  { type: 'event_merchant', eventId: 'wandering_trader' },
  { type: 'event_villager', eventId: 'trapped_villager' },
  { type: 'event_goblin', eventId: 'gambling_goblin' },
];

const ENEMY_POOL: { type: string; weight: number }[] = [
  { type: 'slime', weight: 4 },
  { type: 'rat', weight: 3 },
  { type: 'bat', weight: 2 },
];

export class DungeonGenerator {
  private rng = new Phaser.Math.RandomDataGenerator();
  private minRooms = 3;
  private maxRooms = 5;
  private floorCols = 50;
  private floorRows = 40;

  setSeed(seed: string): void {
    this.rng.init([seed]);
  }

  generateFloor(depth: number): DungeonFloor {
    const cols = this.floorCols;
    const rows = this.floorRows;

    const tiles: DungeonTile[][] = [];
    for (let y = 0; y < rows; y++) {
      tiles[y] = [];
      for (let x = 0; x < cols; x++) {
        tiles[y][x] = this.makeTile('wall');
      }
    }

    const isBossFloor = depth > 0 && depth % 5 === 4;

    let rooms: RoomRect[];
    let entryX: number;
    let entryY: number;
    let exitX: number;
    let exitY: number;
    let puzzle: { totalPlates: number; pressedPlates: number; room: { x: number; y: number; w: number; h: number } } | undefined;

    if (isBossFloor) {
      rooms = this.placeBossRoom(cols, rows);
      const caps = this.getFloorCaps(depth);
      this.carveRoom(tiles, rooms[0], depth, { bronze: 0, silver: 0, gold: 0 }, caps);

      const centerX = Math.floor(rooms[0].x + rooms[0].w / 2);
      const centerY = Math.floor(rooms[0].y + rooms[0].h / 2);

      entryX = centerX;
      entryY = centerY + 3;
      tiles[entryY][entryX] = this.makeTile('floor');

      tiles[centerY][centerX] = {
        type: 'event_boss',
        resource: getBiomeKey(depth),
        durability: 0,
        maxDurability: 0,
        broken: false,
        eventId: 'boss',
      };

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const by = centerY + dy;
          const bx = centerX + dx;
          if (by >= 0 && by < rows && bx >= 0 && bx < cols) {
            tiles[by][bx] = {
              type: 'boss_body',
              resource: '',
              durability: 0,
              maxDurability: 0,
              broken: false,
              eventId: '',
            };
          }
        }
      }

      exitX = entryX;
      exitY = entryY;

      // Place 1 carrot in boss room on a non-center floor tile
      const bossFloorCandidates: { x: number; y: number }[] = [];
      for (let y = rooms[0].y + 1; y < rooms[0].y + rooms[0].h - 1; y++) {
        for (let x = rooms[0].x + 1; x < rooms[0].x + rooms[0].w - 1; x++) {
          if (tiles[y][x].type === 'floor' && !(x === centerX && y === centerY)) {
            bossFloorCandidates.push({ x, y });
          }
        }
      }
      if (bossFloorCandidates.length > 0) {
        const pick = bossFloorCandidates[Math.floor(this.rng.frac() * bossFloorCandidates.length)];
        tiles[pick.y][pick.x] = this.makeTile('carrot_pickup');
      }
    } else {
      rooms = this.placeRooms(cols, rows);

      const caps = this.getFloorCaps(depth);
      const n = rooms.length;
      const distribute = (total: number): number[] => {
        const base = Math.floor(total / n);
        const rem = total % n;
        const arr = Array(n).fill(base);
        const indices = Array.from({ length: n }, (_, i) => i);
        this.rng.shuffle(indices);
        for (let r = 0; r < rem; r++) arr[indices[r]]++;
        return arr;
      };
      const bronzePerRoom = distribute(caps.maxBronze);
      const silverPerRoom = distribute(caps.maxSilver);
      const goldPerRoom = distribute(caps.maxGold);
      for (let i = 0; i < n; i++) {
        this.carveRoom(tiles, rooms[i], depth, { bronze: 0, silver: 0, gold: 0 }, {
          maxBronze: bronzePerRoom[i],
          maxSilver: silverPerRoom[i],
          maxGold: goldPerRoom[i],
        });
      }

      for (let i = 0; i < rooms.length - 1; i++) {
        this.carveCorridor(tiles, rooms[i], rooms[i + 1]);
      }

      this.placeEventTiles(tiles, rooms, depth);
      this.placeEnemyTiles(tiles, rooms);

      const exitRoomIndex = rooms.length - 1;

      if (depth >= 2 && gameState.restoredBuildings.has('trading_post')) {
        this.placeShopTile(tiles, rooms);
      }

      if (depth >= 1 && this.rng.frac() < 0.4) {
        this.placeTreasureVault(tiles, rooms);
      }

      this.fixCorridorEntries(tiles);

      if (depth >= 1 && this.rng.frac() < 0.25) {
        const result = this.placePuzzle(tiles, rooms);
        if (result) {
          puzzle = { totalPlates: result.totalPlates, pressedPlates: 0, room: result.room };
        }
      }

      if (depth >= 10 && this.rng.frac() < 0.15) {
        this.placeRelicChamber(tiles, rooms);
      }

      const entryRoom = rooms[0];
      const exitRoom = rooms[exitRoomIndex];

      entryX = Math.floor(entryRoom.x + entryRoom.w / 2);
      entryY = Math.floor(entryRoom.y + entryRoom.h / 2);
      exitX = Math.floor(exitRoom.x + exitRoom.w / 2);
      exitY = Math.floor(exitRoom.y + exitRoom.h / 2);

      if (puzzle && tiles[entryY][entryX].type === 'pressure_plate') puzzle.totalPlates--;
      tiles[entryY][entryX] = this.makeTile(depth % 5 === 0 ? 'stairs_up' : 'floor');
      if (puzzle && tiles[exitY][exitX].type === 'pressure_plate') puzzle.totalPlates--;
      tiles[exitY][exitX] = this.makeTile('floor');

      // Place carrots on random floor tiles
      const maxCarrots = (depth % 5) + 1;
      const carrotCandidates: { x: number; y: number }[] = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (tiles[y][x].type === 'floor'
            && !(x === entryX && y === entryY)
            && !(x === exitX && y === exitY)) {
            carrotCandidates.push({ x, y });
          }
        }
      }
      this.rng.shuffle(carrotCandidates);
      for (let i = 0; i < Math.min(maxCarrots, carrotCandidates.length); i++) {
        const p = carrotCandidates[i];
        tiles[p.y][p.x] = this.makeTile('carrot_pickup');
      }
    }

    let mineableCount = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (tiles[y][x].type === 'mineable') mineableCount++;
      }
    }
    const initialMineableCount = mineableCount;

    return {
      tiles,
      cols,
      rows,
      entryX,
      entryY,
      stairsDownX: exitX,
      stairsDownY: exitY,
      depth,
      initialMineableCount,
      mineableCount,
      puzzle,
      interactedDecorations: new Set(),
    };
  }

  private makeTile(type: TileType, eventId?: string): DungeonTile {
    const tile: DungeonTile = {
      type,
      resource: '',
      durability: 0,
      maxDurability: 0,
      broken: false,
      eventId: eventId ?? '',
    };
    if (type === 'wall') {
      tile.durability = 4;
      tile.maxDurability = 4;
    }
    return tile;
  }

  private placeRooms(cols: number, rows: number): RoomRect[] {
    const rooms: RoomRect[] = [];
    const numRooms = this.minRooms + this.rng.integerInRange(0, this.maxRooms - this.minRooms);
    let attempts = 0;

    while (rooms.length < numRooms && attempts < 100) {
      attempts++;
      const w = 10 + this.rng.integerInRange(0, 4);
      const h = 8 + this.rng.integerInRange(0, 3);
      const x = 1 + this.rng.integerInRange(0, cols - w - 3);
      const y = 1 + this.rng.integerInRange(0, rows - h - 3);

      const padding = 3;
      let overlaps = false;
      for (const r of rooms) {
        if (
          x < r.x + r.w + padding &&
          x + w + padding > r.x &&
          y < r.y + r.h + padding &&
          y + h + padding > r.y
        ) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        rooms.push({ x, y, w, h });
      }
    }

    if (rooms.length < 2) {
      rooms.length = 0;
      const margin = 4;
      rooms.push({ x: margin, y: Math.floor(rows / 2) - 4, w: 12, h: 9 });
      rooms.push({ x: cols - margin - 12, y: Math.floor(rows / 2) - 4, w: 12, h: 9 });
    }

    return rooms;
  }

  private getFloorCaps(depth: number): { maxBronze: number; maxSilver: number; maxGold: number } {
    if (depth <= 0) return { maxBronze: 1, maxSilver: 0, maxGold: 0 };
    if (depth <= 1) return { maxBronze: 2, maxSilver: 0, maxGold: 0 };
    if (depth <= 3) return { maxBronze: 3, maxSilver: 0, maxGold: 0 };
    if (depth <= 4) return { maxBronze: 4, maxSilver: 0, maxGold: 0 };
    if (depth <= 5) return { maxBronze: 5, maxSilver: 1, maxGold: 0 };
    if (depth <= 6) return { maxBronze: 6, maxSilver: 2, maxGold: 0 };
    if (depth <= 7) return { maxBronze: 7, maxSilver: 3, maxGold: 0 };
    if (depth <= 8) return { maxBronze: 8, maxSilver: 4, maxGold: 0 };
    if (depth <= 9) return { maxBronze: 9, maxSilver: 5, maxGold: 0 };
    if (depth <= 10) return { maxBronze: 10, maxSilver: 5, maxGold: 1 };
    if (depth <= 11) return { maxBronze: 11, maxSilver: 6, maxGold: 1 };
    if (depth <= 12) return { maxBronze: 12, maxSilver: 7, maxGold: 2 };
    if (depth <= 13) return { maxBronze: 13, maxSilver: 8, maxGold: 3 };
    if (depth <= 14) return { maxBronze: 14, maxSilver: 9, maxGold: 4 };
    return { maxBronze: 15, maxSilver: 10, maxGold: 5 };
  }

  private pickResource(depth: number): { id: string; durability: number } {
    const roll = this.rng.frac();
    const biomeFloor = depth % 5;
    if (depth <= 4) {
      if (roll < 0.65 - biomeFloor * 0.03) return { id: 'stone', durability: 2 };
      if (roll < 0.95 - biomeFloor * 0.02) return { id: 'bronze_ore', durability: 3 };
      if (biomeFloor >= 2 && roll < 0.98 - biomeFloor * 0.01) return { id: 'silver_ore', durability: 5 };
      return { id: 'stone', durability: 2 };
    }
    if (depth <= 9) {
      if (roll < 0.30 - biomeFloor * 0.02) return { id: 'stone', durability: 2 };
      if (roll < 0.80 - biomeFloor * 0.03) return { id: 'bronze_ore', durability: 3 };
      return { id: 'silver_ore', durability: 5 };
    }
    if (depth <= 14) {
      if (roll < 0.15 - biomeFloor * 0.01) return { id: 'stone', durability: 2 };
      if (roll < 0.45 - biomeFloor * 0.02) return { id: 'bronze_ore', durability: 3 };
      if (roll < 0.85 - biomeFloor * 0.02) return { id: 'silver_ore', durability: 5 };
      return { id: 'gold_ore', durability: 7 };
    }
    if (depth <= 19) {
      if (roll < 0.10 - biomeFloor * 0.01) return { id: 'stone', durability: 2 };
      if (roll < 0.25 - biomeFloor * 0.01) return { id: 'bronze_ore', durability: 3 };
      if (roll < 0.55 - biomeFloor * 0.02) return { id: 'silver_ore', durability: 5 };
      return { id: 'gold_ore', durability: 7 };
    }
    if (roll < 0.05) return { id: 'stone', durability: 2 };
    if (roll < 0.10) return { id: 'bronze_ore', durability: 3 };
    if (roll < 0.30) return { id: 'silver_ore', durability: 5 };
    return { id: 'gold_ore', durability: 7 };
  }

  private carveRoom(
    tiles: DungeonTile[][], room: RoomRect, depth: number,
    counts: { bronze: number; silver: number; gold: number },
    roomCaps: { maxBronze: number; maxSilver: number; maxGold: number }
  ): void {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1) {
          tiles[y][x] = this.makeTile('wall');
        } else {
          const roll = this.rng.frac();
          if (roll < 0.18) {
            const res = this.pickResource(depth);
            let finalId = res.id;
            if (finalId === 'gold_ore' && counts.gold >= roomCaps.maxGold) finalId = 'silver_ore';
            if (finalId === 'silver_ore' && counts.silver >= roomCaps.maxSilver) finalId = 'bronze_ore';
            if (finalId === 'bronze_ore' && counts.bronze >= roomCaps.maxBronze) finalId = 'stone';

            if (finalId === 'gold_ore') counts.gold++;
            else if (finalId === 'silver_ore') counts.silver++;
            else if (finalId === 'bronze_ore') counts.bronze++;

            const durMap: Record<string, number> = { stone: 2, bronze_ore: 3, silver_ore: 5, gold_ore: 7 };
            tiles[y][x] = {
              type: 'mineable',
              resource: finalId,
              durability: durMap[finalId] ?? 2,
              maxDurability: durMap[finalId] ?? 2,
              broken: false,
              eventId: '',
            };
          } else {
            tiles[y][x] = this.makeTile('floor');
          }
        }
      }
    }
  }

  private getFloorPositions(tiles: DungeonTile[][], room: RoomRect): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
        const tile = tiles[y][x];
        if (tile.type === 'floor' && !tile.broken) positions.push({ x, y });
      }
    }
    return positions;
  }

  private canSpawnVillager(depth: number): boolean {
    if (gameState.rescuedVillagers.length >= 20) return false;
    if (gameState.villagerRescueFloors.has(depth)) return false;
    if (!gameState.restoredBuildings.has('housing')) return false;
    return true;
  }

  private placeEventTiles(tiles: DungeonTile[][], rooms: RoomRect[], depth: number): void {
    const canSpawnVillager = this.canSpawnVillager(depth);
    let usedRoom = -1;

    if (canSpawnVillager) {
      const room = this.rng.pick(rooms);
      const positions = this.getFloorPositions(tiles, room);
      if (positions.length > 0) {
        const pos = this.rng.pick(positions);
        tiles[pos.y][pos.x] = this.makeTile('event_villager', 'trapped_villager');
        tiles[pos.y][pos.x].resource = String(gameState.rescuedVillagers.length);
        usedRoom = rooms.indexOf(room);
      }
    }

    const pool = EVENT_POOL.filter(ev => ev.eventId !== 'trapped_villager');
    const shuffled = [...pool];
    this.rng.shuffle(shuffled);
    const maxCount = shuffled.length;
    const roomCount = Math.max(0, rooms.length - (canSpawnVillager ? 1 : 0));
    const count = Math.min(1 + this.rng.integerInRange(0, 1), maxCount, roomCount);

    let ri = 0;
    for (let i = 0; i < count; i++) {
      const ev = shuffled[i];
      while (ri < rooms.length && ri === usedRoom) ri++;
      if (ri >= rooms.length) break;
      const room = rooms[ri % rooms.length];
      ri++;

      const positions = this.getFloorPositions(tiles, room);
      if (positions.length === 0) continue;

      const pos = this.rng.pick(positions);
      tiles[pos.y][pos.x] = this.makeTile(ev.type, ev.eventId);
    }
  }

  private placeShopTile(tiles: DungeonTile[][], rooms: RoomRect[]): void {
    const room = this.rng.pick(rooms);

    const floorPositions: { x: number; y: number }[] = [];
    for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
        const tile = tiles[y][x];
        if (tile.type === 'floor' && !tile.broken) {
          floorPositions.push({ x, y });
        }
      }
    }

    if (floorPositions.length === 0) return;

    const pos = this.rng.pick(floorPositions);
    tiles[pos.y][pos.x] = this.makeTile('event_shop' as TileType, 'midrun_shop');
  }

  private placeTreasureVault(tiles: DungeonTile[][], rooms: RoomRect[]): void {
    const vw = 6;
    const vh = 6;

    for (let attempt = 0; attempt < 50; attempt++) {
      const vx = 1 + this.rng.integerInRange(0, 50 - vw - 2);
      const vy = 1 + this.rng.integerInRange(0, 40 - vh - 2);

      const overlaps = rooms.some(r =>
        vx < r.x + r.w + 3 && vx + vw + 3 > r.x &&
        vy < r.y + r.h + 3 && vy + vh + 3 > r.y
      );
      if (overlaps) continue;

      for (let y = vy; y < vy + vh; y++) {
        for (let x = vx; x < vx + vw; x++) {
          if (x === vx || x === vx + vw - 1 || y === vy || y === vy + vh - 1) {
            tiles[y][x] = this.makeTile('wall');
          } else {
            tiles[y][x] = this.makeTile('floor');
          }
        }
      }

      const vaultRoom: RoomRect = { x: vx, y: vy, w: vw, h: vh };

      for (let n = 0; n < 2; n++) {
        const ef = this.getFloorTiles(tiles, vaultRoom);
        if (ef.length === 0) break;
        const p = this.rng.pick(ef);
        const totalWeight = 9;
        const roll = this.rng.frac() * totalWeight;
        let chosen = 'slime';
        if (roll < 4) chosen = 'slime';
        else if (roll < 7) chosen = 'rat';
        else chosen = 'bat';
        tiles[p.y][p.x] = {
          type: 'enemy', resource: chosen, durability: 0, maxDurability: 0, broken: false, eventId: chosen,
        };
      }

      const cf = this.getFloorTiles(tiles, vaultRoom);
      if (cf.length > 0) {
        const cp = this.rng.pick(cf);
        tiles[cp.y][cp.x] = this.makeTile('event_treasure_vault' as TileType, 'treasure_vault');
      }

      const nearest = rooms.reduce((best, r) => {
        const dc = Math.abs(r.x - vx) + Math.abs(r.y - vy);
        return dc < best.dist ? { room: r, dist: dc } : best;
      }, { room: rooms[0], dist: Infinity }).room;
      this.carveCorridor(tiles, nearest, vaultRoom);
      rooms.push(vaultRoom);
      return;
    }
  }

  private getFloorTiles(tiles: DungeonTile[][], room: RoomRect): { x: number; y: number }[] {
    const result: { x: number; y: number }[] = [];
    for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
        if (tiles[y][x].type === 'floor') {
          result.push({ x, y });
        }
      }
    }
    return result;
  }

  private placeBossRoom(cols: number, rows: number): RoomRect[] {
    const w = 16;
    const h = 12;
    const x = Math.floor((cols - w) / 2);
    const y = Math.floor((rows - h) / 2);
    return [{ x, y, w, h }];
  }

  private placeEnemyTiles(tiles: DungeonTile[][], rooms: RoomRect[]): void {
    const count = this.rng.integerInRange(2, 3);
    const totalWeight = ENEMY_POOL.reduce((s, e) => s + e.weight, 0);

    for (let n = 0; n < count; n++) {
      const roll = this.rng.frac() * totalWeight;
      let cumulative = 0;
      let chosen = 'slime';
      for (const e of ENEMY_POOL) {
        cumulative += e.weight;
        if (roll < cumulative) { chosen = e.type; break; }
      }

      const room = this.rng.pick(rooms);

      const floorPositions: { x: number; y: number }[] = [];
      for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
        for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
          const tile = tiles[y][x];
          if (tile.type === 'floor' && !tile.broken) {
            floorPositions.push({ x, y });
          }
        }
      }

      if (floorPositions.length === 0) continue;

      const pos = this.rng.pick(floorPositions);
      tiles[pos.y][pos.x] = {
        type: 'enemy',
        resource: chosen,
        durability: 0,
        maxDurability: 0,
        broken: false,
        eventId: chosen,
      };
    }
  }

  private carveCorridor(tiles: DungeonTile[][], a: RoomRect, b: RoomRect): void {
    const ax = Math.floor(a.x + a.w / 2);
    const ay = Math.floor(a.y + a.h / 2);
    const bx = Math.floor(b.x + b.w / 2);
    const by = Math.floor(b.y + b.h / 2);

    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) {
      if (this.inBounds(tiles, x, ay)) {
        this.carveCorridorTile(tiles, x, ay);
      }
    }
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) {
      if (this.inBounds(tiles, bx, y)) {
        this.carveCorridorTile(tiles, bx, y);
      }
    }
  }

  private carveCorridorTile(tiles: DungeonTile[][], x: number, y: number): void {
    if (tiles[y][x].type === 'wall') {
      tiles[y][x] = this.makeTile('corridor');
    }
  }

  private fixCorridorEntries(tiles: DungeonTile[][]): void {
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        if (tiles[y][x].type !== 'corridor') continue;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const wx = x + dx;
          const wy = y + dy;
          if (!this.inBounds(tiles, wx, wy)) continue;
          if (tiles[wy][wx].type !== 'wall') continue;
          const bx = wx + dx;
          const by = wy + dy;
          if (!this.inBounds(tiles, bx, by)) continue;
          if (this.isWalkable(tiles[by][bx])) {
            tiles[wy][wx] = this.makeTile('floor');
          }
        }
      }
    }
  }

  private isWalkable(tile: DungeonTile): boolean {
    return tile.type === 'floor'
      || tile.type === 'mineable'
      || tile.type === 'corridor'
      || tile.type === 'stairs_up'
      || tile.type === 'stairs_down'
      || tile.type === 'secret_stair';
  }

  private placePuzzle(tiles: DungeonTile[][], rooms: RoomRect[]): { totalPlates: number; room: RoomRect } | null {
    const room = this.rng.pick(rooms);

    const floorTiles: { x: number; y: number }[] = [];
    for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
        if (tiles[y][x].type === 'floor') {
          floorTiles.push({ x, y });
        }
      }
    }
    if (floorTiles.length < 8) return null;

    const numPlates = Math.min(5, Math.max(3, Math.floor(floorTiles.length / 4)));
    const plates: { x: number; y: number }[] = [];
    const shuffled = [...floorTiles];
    this.rng.shuffle(shuffled);

    for (const tile of shuffled) {
      if (plates.length >= numPlates) break;
      const tooClose = plates.some(p => Math.abs(p.x - tile.x) + Math.abs(p.y - tile.y) < 3);
      if (!tooClose) {
        plates.push(tile);
      }
    }

    if (plates.length < 2) return null;

    for (const plate of plates) {
      tiles[plate.y][plate.x] = this.makeTile('pressure_plate');
    }

    return { totalPlates: plates.length, room };
  }

  private inBounds(tiles: DungeonTile[][], x: number, y: number): boolean {
    return y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length;
  }

  generateSecretRoom(depth: number): DungeonFloor {
    const cols = 20;
    const rows = 26;

    const tiles: DungeonTile[][] = [];
    for (let y = 0; y < rows; y++) {
      tiles[y] = [];
      for (let x = 0; x < cols; x++) {
        tiles[y][x] = this.makeTile('floor');
      }
    }

    const entryX = Math.floor(cols / 2);
    const entryY = rows - 2;

    const exitX = cols - 4;
    const exitY = rows - 2;
    tiles[exitY][exitX] = this.makeTile('stairs_up');

    tiles[13][10] = this.makeTile('floor');
    tiles[13][10].type = 'secret_npc';
    tiles[13][10].eventId = 'secret_npc';
    tiles[13][10].resource = 'hermit';

    return {
      tiles,
      cols,
      rows,
      entryX,
      entryY,
      stairsDownX: entryX,
      stairsDownY: entryY,
      depth,
      initialMineableCount: 0,
      mineableCount: 0,
      isSecretRoom: true,
      interactedDecorations: new Set(),
    };
  }

  private placeRelicChamber(tiles: DungeonTile[][], rooms: RoomRect[]): void {
    const vw = 6;
    const vh = 6;

    for (let attempt = 0; attempt < 50; attempt++) {
      const vx = 1 + this.rng.integerInRange(0, 50 - vw - 2);
      const vy = 1 + this.rng.integerInRange(0, 40 - vh - 2);

      const overlaps = rooms.some(r =>
        vx < r.x + r.w + 3 && vx + vw + 3 > r.x &&
        vy < r.y + r.h + 3 && vy + vh + 3 > r.y
      );
      if (overlaps) continue;

      for (let y = vy; y < vy + vh; y++) {
        for (let x = vx; x < vx + vw; x++) {
          if (x === vx || x === vx + vw - 1 || y === vy || y === vy + vh - 1) {
            tiles[y][x] = this.makeTile('wall');
          } else {
            tiles[y][x] = this.makeTile('floor');
          }
        }
      }

      const cf = this.getFloorTiles(tiles, { x: vx, y: vy, w: vw, h: vh });
      if (cf.length > 0) {
        const cp = this.rng.pick(cf);
        tiles[cp.y][cp.x] = this.makeTile('event_relic', 'relic_chamber');
      }

      const nearest = rooms.reduce((best, r) => {
        const dc = Math.abs(r.x - vx) + Math.abs(r.y - vy);
        return dc < best.dist ? { room: r, dist: dc } : best;
      }, { room: rooms[0], dist: Infinity }).room;
      this.carveCorridor(tiles, nearest, { x: vx, y: vy, w: vw, h: vh });
      rooms.push({ x: vx, y: vy, w: vw, h: vh });
      return;
    }
  }
}
