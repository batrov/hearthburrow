import Phaser from 'phaser';
import { gameState } from '../systems/GameState';
import { audio } from '../systems/AudioSystem';
import { generateAll } from '../systems/TextureGenerator';

export class BootScene extends Phaser.Scene {
  private loadingBar!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.load.setPath('assets/sprites');

    for (let f = 0; f < 6; f++) {
      this.load.image(`player_bottom_left_${f}`, `player/player_bottom_left_${f}.png`);
      this.load.image(`player_top_right_${f}`, `player/player_top_right_${f}.png`);
    }

    for (let f = 0; f < 3; f++) {
      this.load.image(`player_bottom_left_mining_${f}`, `player/player_bottom_left_mining_${f}.png`);
      this.load.image(`player_top_right_mining_${f}`, `player/player_top_right_mining_${f}.png`);
    }

    this.load.image('wall_FOREST', 'tiles/wall_FOREST.png');
    this.load.image('wall_CAVE', 'tiles/wall_CAVE.png');
    this.load.image('wall_ICE', 'tiles/wall_ICE.png');
    this.load.image('wall_LAVA', 'tiles/wall_LAVA.png');
    this.load.image('wall_RUINS', 'tiles/wall_RUINS.png');

    const BIOMES = ['FOREST', 'CAVE', 'ICE', 'LAVA', 'RUINS'];
    for (const b of BIOMES) {
      this.load.image(`floor_${b}_a`, `tiles/floor_${b}_a.png`);
      this.load.image(`floor_${b}_b`, `tiles/floor_${b}_b.png`);
      this.load.image(`corridor_${b}`, `tiles/corridor_${b}.png`);
    }

    this.load.image('stairs_up', 'tiles/stairs_up.png');
    this.load.image('stairs_down', 'tiles/stairs_down.png');
    this.load.image('pressure_plate', 'tiles/pressure_plate.png');
    this.load.image('blocked', 'tiles/blocked.png');

    this.load.image('ore_stone', 'ores/stone.png');
    this.load.image('ore_bronze_ore', 'ores/bronze_ore.png');
    this.load.image('ore_silver_ore', 'ores/silver_ore.png');
    this.load.image('ore_gold_ore', 'ores/gold_ore.png');
    this.load.image('ore_crystal', 'ores/crystal.png');
    this.load.image('ore_monster_drop', 'ores/monster_drop.png');

    this.load.image('enemy_slime', 'enemies/slime.png');
    this.load.image('enemy_rat', 'enemies/rat.png');
    this.load.image('enemy_bat', 'enemies/bat.png');
    this.load.image('enemy_boss', 'enemies/boss.png');

    this.load.image('event_chest', 'events/chest.png');
    this.load.image('event_merchant', 'events/merchant.png');
    this.load.image('event_goblin', 'events/goblin.png');
    this.load.image('event_villager', 'events/villager.png');
    this.load.image('event_fountain', 'events/fountain.png');
    this.load.image('event_shop', 'events/shop.png');
    this.load.image('event_treasure_vault', 'events/treasure_vault.png');
    this.load.image('event_relic', 'events/relic.png');

    this.load.image('overlay_damage', 'overlays/damage.png');
    this.load.image('overlay_crack', 'overlays/crack.png');

    this.load.image('terrain_diamond', 'tiles/terrain_diamond.png');
    this.load.image('building_trading_post', 'tiles/building_trading_post.png');
    this.load.image('building_crafting', 'tiles/building_crafting.png');
    this.load.image('building_farm', 'tiles/building_farm.png');
    this.load.image('building_tavern', 'tiles/building_tavern.png');
    this.load.image('building_storage', 'tiles/building_storage.png');
    this.load.image('building_laboratory', 'tiles/building_laboratory.png');
    this.load.image('building_gate', 'tiles/building_gate.png');
    this.load.image('gate_glow', 'tiles/gate_glow.png');
    this.load.image('villager_npc', 'npcs/villager_npc.png');
    for (let i = 0; i < 20; i++) {
      this.load.image(`npc_${i}`, `npcs/npc_${i}.png`);
    }

    const itemSprites = [
      'pickaxe_1', 'pickaxe_2', 'pickaxe_3', 'pickaxe_4',
      'ring_critical', 'ring_damage', 'ring_precision', 'ring_hunter',
      'boots_stamina_bronze', 'boots_stamina_silver', 'boots_stamina_gold',
      'boots_luck_bronze', 'boots_luck_silver', 'boots_luck_gold',
      'boots_regen',
      'lantern_bronze', 'lantern_silver', 'lantern_gold',
      'stamina_potion', 'teleport_scroll', 'mining_bomb',
      'arrow_left', 'arrow_right',
    ];
    for (const id of itemSprites) {
      this.load.image(`item_${id}`, `items/${id}.png`);
    }

    this.load.image('portrait', 'player/portrait.png');
    this.load.image('item_inventory_bag', 'items/inventory_bag.png');
  }

  create(): void {
    gameState.load();
    audio.init();
    audio.setMasterVolume(gameState.masterVolume);
    audio.setSfxVolume(gameState.sfxVolume);

    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    this.cameras.main.setBackgroundColor('#0a0a1a');
    generateAll(this);

    this.add.text(cx, cy - 80, 'HEARTHBURROW', {
      fontSize: '48px',
      fontFamily: 'monospace',
      color: '#e8d5b7',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 30, 'a cozy mining roguelite', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#8a7a6a',
    }).setOrigin(0.5);

    const barWidth = 300;
    const barHeight = 20;
    const barX = cx - barWidth / 2;
    const barY = cy + 30;

    const barBg = this.add.graphics();
    barBg.fillStyle(0x2a2a3a, 1);
    barBg.fillRoundedRect(barX, barY, barWidth, barHeight, 4);

    this.loadingBar = this.add.graphics();

    this.progressText = this.add.text(cx, barY + barHeight + 12, 'Loading...', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#6a5a4a',
    }).setOrigin(0.5);

    const startGame = () => {
      this.progressText.setText('Ready!');
      this.time.delayedCall(300, () => {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('HomelandScene');
        });
      });
    };

    this.load.on('progress', (progress: number) => {
      const pct = Math.floor(progress * 100);
      this.loadingBar.clear();
      this.loadingBar.fillStyle(0xe8d5b7, 1);
      this.loadingBar.fillRoundedRect(barX + 2, barY + 2, (barWidth - 4) * progress, barHeight - 4, 3);
      this.progressText.setText(`${pct}%`);
    });

    this.load.once('complete', startGame);
    this.time.delayedCall(3000, startGame);
  }
}
