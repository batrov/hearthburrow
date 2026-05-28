export type TileType = 'wall' | 'floor' | 'mineable' | 'stairs_up' | 'stairs_down' | 'corridor'
  | 'event_chest' | 'event_merchant' | 'event_goblin' | 'event_villager' | 'event_fountain'
  | 'event_shop'
  | 'event_treasure_vault'
  | 'enemy' | 'event_boss';

export interface DungeonTile {
  type: TileType;
  resource: string;
  durability: number;
  maxDurability: number;
  broken: boolean;
  eventId: string;
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
  { type: 'event_shop', eventId: 'midrun_shop' },
];

const ENEMY_POOL: { type: string; weight: number }[] = [
  { type: 'slime', weight: 4 },
  { type: 'rat', weight: 3 },
  { type: 'bat', weight: 2 },
];

export class DungeonGenerator {
  private minRooms = 3;
  private maxRooms = 5;
  private floorCols = 50;
  private floorRows = 40;

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

    if (isBossFloor) {
      rooms = this.placeBossRoom(cols, rows);
      this.carveRoom(tiles, rooms[0], depth);

      const centerX = Math.floor(rooms[0].x + rooms[0].w / 2);
      const centerY = Math.floor(rooms[0].y + rooms[0].h / 2);

      entryX = centerX;
      entryY = centerY + 3;
      tiles[entryY][entryX] = this.makeTile('floor');

      tiles[centerY][centerX] = {
        type: 'event_boss',
        resource: 'boss',
        durability: 0,
        maxDurability: 0,
        broken: false,
        eventId: 'boss',
      };

      exitX = entryX;
      exitY = entryY;
    } else {
      rooms = this.placeRooms(cols, rows);

      for (const room of rooms) {
        this.carveRoom(tiles, room, depth);
      }

      for (let i = 0; i < rooms.length - 1; i++) {
        this.carveCorridor(tiles, rooms[i], rooms[i + 1]);
      }

      this.placeEventTiles(tiles, rooms);
      this.placeEnemyTiles(tiles, rooms);

      const exitRoomIndex = rooms.length - 1;

      if (depth >= 2) {
        this.placeShopTile(tiles, rooms);
      }

      if (depth >= 1 && Math.random() < 0.4) {
        this.placeTreasureVault(tiles, rooms);
      }

      const entryRoom = rooms[0];
      const exitRoom = rooms[exitRoomIndex];

      entryX = Math.floor(entryRoom.x + entryRoom.w / 2);
      entryY = Math.floor(entryRoom.y + entryRoom.h / 2);
      exitX = Math.floor(exitRoom.x + exitRoom.w / 2);
      exitY = Math.floor(exitRoom.y + exitRoom.h / 2);

      tiles[entryY][entryX] = this.makeTile(depth % 5 === 0 ? 'stairs_up' : 'floor');
      tiles[exitY][exitX] = this.makeTile('stairs_down');
    }

    return {
      tiles,
      cols,
      rows,
      entryX,
      entryY,
      stairsDownX: exitX,
      stairsDownY: exitY,
      depth,
    };
  }

  private makeTile(type: TileType, eventId?: string): DungeonTile {
    return {
      type,
      resource: '',
      durability: 0,
      maxDurability: 0,
      broken: false,
      eventId: eventId ?? '',
    };
  }

  private placeRooms(cols: number, rows: number): RoomRect[] {
    const rooms: RoomRect[] = [];
    const numRooms = this.minRooms + Math.floor(Math.random() * (this.maxRooms - this.minRooms + 1));
    let attempts = 0;

    while (rooms.length < numRooms && attempts < 100) {
      attempts++;
      const w = 10 + Math.floor(Math.random() * 5);
      const h = 8 + Math.floor(Math.random() * 4);
      const x = 1 + Math.floor(Math.random() * (cols - w - 2));
      const y = 1 + Math.floor(Math.random() * (rows - h - 2));

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

  private pickResource(depth: number): { id: string; durability: number } {
    const roll = Math.random();
    const biomeFloor = depth % 5;
    if (depth <= 4) {
      if (roll < 0.65 - biomeFloor * 0.03) return { id: 'stone', durability: 2 };
      if (roll < 0.95 - biomeFloor * 0.02) return { id: 'bronze_ore', durability: 3 };
      if (biomeFloor >= 2 && roll < 0.98 - biomeFloor * 0.01) return { id: 'silver_ore', durability: 4 };
      return { id: 'stone', durability: 2 };
    }
    if (depth <= 9) {
      if (roll < 0.30 - biomeFloor * 0.02) return { id: 'stone', durability: 2 };
      if (roll < 0.80 - biomeFloor * 0.03) return { id: 'bronze_ore', durability: 3 };
      return { id: 'silver_ore', durability: 4 };
    }
    if (depth <= 14) {
      if (roll < 0.15 - biomeFloor * 0.01) return { id: 'stone', durability: 2 };
      if (roll < 0.45 - biomeFloor * 0.02) return { id: 'bronze_ore', durability: 3 };
      if (roll < 0.85 - biomeFloor * 0.02) return { id: 'silver_ore', durability: 4 };
      return { id: 'gold_ore', durability: 5 };
    }
    if (depth <= 19) {
      if (roll < 0.10 - biomeFloor * 0.01) return { id: 'stone', durability: 2 };
      if (roll < 0.25 - biomeFloor * 0.01) return { id: 'bronze_ore', durability: 3 };
      if (roll < 0.55 - biomeFloor * 0.02) return { id: 'silver_ore', durability: 4 };
      return { id: 'gold_ore', durability: 5 };
    }
    if (roll < 0.05) return { id: 'stone', durability: 2 };
    if (roll < 0.10) return { id: 'bronze_ore', durability: 3 };
    if (roll < 0.30) return { id: 'silver_ore', durability: 4 };
    return { id: 'gold_ore', durability: 5 };
  }

  private carveRoom(tiles: DungeonTile[][], room: RoomRect, depth: number): void {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1) {
          tiles[y][x] = this.makeTile('wall');
        } else {
          const roll = Math.random();
          if (roll < 0.18) {
            const res = this.pickResource(depth);
            tiles[y][x] = {
              type: 'mineable',
              resource: res.id,
              durability: res.durability,
              maxDurability: res.durability,
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

  private placeEventTiles(tiles: DungeonTile[][], rooms: RoomRect[]): void {
    const available = [...EVENT_POOL];
    const shuffled = available.sort(() => Math.random() - 0.5);
    const count = Math.min(1 + Math.floor(Math.random() * 2), shuffled.length, rooms.length);

    for (let i = 0; i < count; i++) {
      const ev = shuffled[i];
      const room = rooms[i % rooms.length];

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

      const pos = floorPositions[Math.floor(Math.random() * floorPositions.length)];
      tiles[pos.y][pos.x] = this.makeTile(ev.type, ev.eventId);
    }
  }

  private placeShopTile(tiles: DungeonTile[][], rooms: RoomRect[]): void {
    const room = rooms[Math.floor(Math.random() * rooms.length)];

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

    const pos = floorPositions[Math.floor(Math.random() * floorPositions.length)];
    tiles[pos.y][pos.x] = this.makeTile('event_shop' as TileType, 'midrun_shop');
  }

  private placeTreasureVault(tiles: DungeonTile[][], rooms: RoomRect[]): void {
    const vw = 6;
    const vh = 6;

    for (let attempt = 0; attempt < 50; attempt++) {
      const vx = 1 + Math.floor(Math.random() * (50 - vw - 1));
      const vy = 1 + Math.floor(Math.random() * (40 - vh - 1));

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
        const p = ef[Math.floor(Math.random() * ef.length)];
        const totalWeight = 9;
        const roll = Math.random() * totalWeight;
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
        const cp = cf[Math.floor(Math.random() * cf.length)];
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
    const count = 2 + Math.floor(Math.random() * 2);
    const totalWeight = ENEMY_POOL.reduce((s, e) => s + e.weight, 0);

    for (let n = 0; n < count; n++) {
      const roll = Math.random() * totalWeight;
      let cumulative = 0;
      let chosen = 'slime';
      for (const e of ENEMY_POOL) {
        cumulative += e.weight;
        if (roll < cumulative) { chosen = e.type; break; }
      }

      const room = rooms[Math.floor(Math.random() * rooms.length)];

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

      const pos = floorPositions[Math.floor(Math.random() * floorPositions.length)];
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

  private inBounds(tiles: DungeonTile[][], x: number, y: number): boolean {
    return y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length;
  }
}
