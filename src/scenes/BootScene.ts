import Phaser from 'phaser';
import { gameState } from '../systems/GameState';
import { getStorageStatus } from '../systems/Platform';
import { audio } from '../systems/AudioSystem';
import { generateAll } from '../systems/TextureGenerator';
import { textStyle, fs, createText } from '../systems/Font';
import { SCENES } from '../constants/scenes';

export class BootScene extends Phaser.Scene {
  private loadingBar!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private newTabLink: HTMLAnchorElement | null = null;

  constructor() {
    super({ key: SCENES.BOOT });
  }

  preload(): void {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    this.cameras.main.setBackgroundColor('#0a0a1a');

    // Loading bar
    const barWidth = 300;
    const barHeight = 20;
    const barX = cx - barWidth / 2;
    const barY = cy + 10;

    const barBg = this.add.graphics();
    barBg.fillStyle(0x2a2a3a, 1);
    barBg.fillRoundedRect(barX, barY, barWidth, barHeight, 4);

    this.loadingBar = this.add.graphics();

    this.progressText = createText(this, cx, barY + barHeight + 12, 'Loading...', {
      fontSize: fs(14),
      fontFamily: 'Inter', resolution: 4,
      color: '#6a5a4a',
    }).setOrigin(0.5);

    // Queue title first so it loads early
    this.load.setPath('');
    this.load.image('title_img', 'icons/title.png');

    // Show title image as soon as it finishes loading
    this.load.once('filecomplete-image-title_img', () => {
      this.add.image(cx, cy - 80, 'title_img').setOrigin(0.5).setScale(0.7);
    });

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

    this.load.image('stone_node', 'ores/stone_node.png');
    this.load.image('bronze_ore_node', 'ores/bronze_ore_node.png');
    this.load.image('silver_ore_node', 'ores/silver_ore_node.png');
    this.load.image('gold_ore_node', 'ores/gold_ore_node.png');
    this.load.image('crystal_node', 'ores/crystal_node.png');
    this.load.image('monster_drop_node', 'ores/monster_drop_node.png');

    this.load.image('stone_ore', 'ores/stone_ore.png');
    this.load.image('bronze_ore', 'ores/bronze_ore.png');
    this.load.image('silver_ore', 'ores/silver_ore.png');
    this.load.image('gold_ore', 'ores/gold_ore.png');
    this.load.image('crystal_ore', 'ores/crystal_ore.png');
    this.load.image('monster_drop_ore', 'ores/monster_drop_ore.png');

    this.load.image('enemy_slime', 'enemies/slime.png');
    this.load.image('enemy_rat', 'enemies/rat.png');
    this.load.image('enemy_bat', 'enemies/bat.png');
    this.load.image('enemy_boss_FOREST', 'enemies/boss_forest.png');
    this.load.image('enemy_boss_CAVE', 'enemies/boss_cave.png');
    this.load.image('enemy_boss_ICE', 'enemies/boss_ice.png');
    this.load.image('enemy_boss_LAVA', 'enemies/boss_lava.png');
    this.load.image('enemy_boss_RUINS', 'enemies/boss_ruins.png');

    this.load.image('event_chest', 'events/chest.png');
    this.load.image('event_merchant', 'events/merchant.png');
    this.load.image('event_goblin', 'events/goblin.png');
    this.load.image('event_villager', 'events/villager.png');
    this.load.image('event_fountain', 'events/fountain.png');
    this.load.image('event_shop', 'events/shop.png');
    this.load.image('event_treasure_vault', 'events/treasure_vault.png');
    this.load.image('event_relic', 'events/relic.png');

    this.load.image('terrain_diamond', 'tiles/terrain_diamond.png');
    this.load.image('terrain_grass_a', 'tiles/terrain_grass_a.png');
    this.load.image('terrain_grass_b', 'tiles/terrain_grass_b.png');
    this.load.image('terrain_path', 'tiles/terrain_path.png');
    this.load.image('terrain_bridge', 'tiles/terrain_bridge.png');
    this.load.image('terrain_water', 'tiles/terrain_water.png');
    this.load.image('building_trading_post', 'tiles/building_trading_post.png');
    this.load.image('building_crafting', 'tiles/building_crafting.png');
    this.load.image('building_farm', 'tiles/building_farm.png');
    this.load.image('building_tavern', 'tiles/building_tavern.png');
    this.load.image('building_storage', 'tiles/building_storage.png');
    this.load.image('building_laboratory', 'tiles/building_laboratory.png');
    this.load.image('building_gate', 'tiles/building_gate.png');
    this.load.image('gate_glow', 'tiles/gate_glow.png');

    const decorationSprites = [
      'decoration_tree_pine', 'decoration_tree_oak',
      'decoration_bush', 'decoration_rock',
      'decoration_flower_red', 'decoration_flower_yellow',
      'decoration_fence', 'decoration_lantern_post',
      'decoration_well', 'decoration_signpost',
    ];
    for (const id of decorationSprites) {
      this.load.image(id, `decoration/${id}.png`);
    }

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

    this.load.setPath('');
    this.load.audio('music_tavern', 'music/tavern.mp3');
    this.load.setPath('assets/sprites');

    // UI 9-slice textures
    this.load.image('ui_panel_bg', 'ui/ui_panel_bg.png');
    this.load.image('ui_card_bg', 'ui/ui_card_bg.png');
    this.load.image('ui_slot_bg', 'ui/ui_slot_bg.png');
    this.load.image('ui_modal_bg', 'ui/ui_modal_bg.png');
    this.load.image('ui_btn_bg', 'ui/ui_btn_bg.png');
    this.load.image('ui_btn_sm', 'ui/ui_btn_sm.png');

    this.load.on('progress', (progress: number) => {
      const pct = Math.floor(progress * 100);
      this.loadingBar.clear();
      this.loadingBar.fillStyle(0xe8d5b7, 1);
      this.loadingBar.fillRoundedRect(barX + 2, barY + 2, (barWidth - 4) * progress, barHeight - 4, 3);
      this.progressText.setText(`${pct}%`);
    });

    this.load.once('complete', () => {
      this.progressText.setText('[ click anywhere to proceed ]');
      this.tweens.add({
        targets: this.progressText,
        alpha: { from: 1, to: 0.3 },
        duration: 800,
        yoyo: true,
        repeat: -1,
      });
    });
  }

  create(): void {
    gameState.load();
    audio.init();
    audio.setMasterVolume(gameState.masterVolume);
    audio.setSfxVolume(gameState.sfxVolume);

    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    // Title is already showing (loaded in preload via filecomplete event)

    // Generate procedural fallbacks for any textures that didn't load (missing PNGs)
    generateAll(this);

    // Set nearest-neighbor filtering for pixel-art textures (characters, items, enemies)
    // while everything else (UI, title, terrain) keeps the default LINEAR for smooth scaling.
    const pixelArtKeys = new Set([
      'portrait', 'boss_body', 'carrot_pickup',
      'monster_drop_ore', 'monster_drop_node',
      'stone_ore', 'bronze_ore', 'silver_ore', 'gold_ore', 'crystal_ore',
      'stone_node', 'bronze_ore_node', 'silver_ore_node', 'gold_ore_node', 'crystal_node',
    ]);
    for (const key of this.textures.getTextureKeys()) {
      if (key.startsWith('player_') || key.startsWith('npc_') || key.startsWith('event_') || key.startsWith('enemy_') || key.startsWith('item_') || pixelArtKeys.has(key)) {
        const tex = this.textures.get(key);
        if (tex?.source[0]) tex.source[0].setFilter(1);
      }
    }

    const proceed = () => {
      this.removeNewTabLink();
      this.tweens.killTweensOf(this.progressText);
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SCENES.HOMELAND);
      });
    };

    const armProceed = () => {
      this.input.once('pointerdown', proceed);
      this.input.keyboard?.on('keydown-SPACE', proceed);
      this.input.keyboard?.on('keydown-ENTER', proceed);
    };

    switch (getStorageStatus()) {
      case 'blocked':
        // localStorage throws (e.g. Safari Private Mode) — nothing can persist,
        // and opening a new tab won't help, so just inform and let them play.
        this.showStorageWarning(cx, cy,
          '⚠ Storage Unavailable\n\n' +
          'This browser is blocking local storage\n' +
          '(e.g. Private Browsing), so progress\n' +
          'will NOT be saved.\n\n' +
          'Turn off Private Browsing to save.\n\n' +
          'Tap anywhere to continue anyway.',
          false, armProceed);
        break;
      case 'ephemeral':
        // iOS embedded iframe: writes succeed but are wiped on reload. The fix
        // is to play in a top-level tab, which the link below opens.
        this.showStorageWarning(cx, cy,
          "⚠ Progress Won't Save Here\n\n" +
          "iOS doesn't save progress for games\n" +
          'embedded in a page.\n\n' +
          'Tap the button below to open the game\n' +
          'in its own tab, where progress is saved.\n' +
          '(Start fresh there — this session\n' +
          "won't carry over.)\n\n" +
          'Or tap anywhere else to play without saving.',
          true, armProceed);
        break;
      default:
        armProceed();
    }

    this.time.delayedCall(3000, () => {
      if (this.scene.isActive(SCENES.BOOT)) {
        this.progressText.setText('[ click anywhere to proceed ]');
      }
    });
  }

  /**
   * Show a full-screen storage warning. When `withNewTabLink` is set, also
   * overlays a real DOM anchor that opens the game as its own top-level tab
   * (the only way to restore saving inside an iOS embedded iframe). Tapping
   * the dim area dismisses the warning and calls `onDismiss`.
   */
  private showStorageWarning(
    cx: number, cy: number, message: string,
    withNewTabLink: boolean, onDismiss: () => void,
  ): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const overlay = this.add.rectangle(cx, cy, w + 8, h + 8, 0x000000, 0.9)
      .setScrollFactor(0).setDepth(1000).setInteractive();
    const text = createText(this, cx, cy, message, {
      fontSize: fs(14),
      fontFamily: 'Inter', resolution: 4,
      color: '#ffaa44',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5).setDepth(1001);

    if (withNewTabLink) {
      this.createNewTabLink();
    }

    overlay.on('pointerdown', () => {
      overlay.destroy();
      text.destroy();
      this.removeNewTabLink();
      onDismiss();
    });
  }

  /** Overlay a DOM anchor that opens the current URL as a top-level tab. */
  private createNewTabLink(): void {
    const a = document.createElement('a');
    a.href = window.location.href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = '→ Open in a new tab to save progress';
    a.style.cssText = [
      'position:fixed',
      'left:50%',
      'top:66%',
      'transform:translate(-50%,-50%)',
      'z-index:2147483647',
      'padding:12px 18px',
      'background:#ffaa44',
      'color:#1a1a2e',
      'font:bold 15px Inter,-apple-system,sans-serif',
      'border-radius:8px',
      'text-decoration:none',
      'box-shadow:0 2px 12px rgba(0,0,0,0.5)',
      '-webkit-tap-highlight-color:transparent',
    ].join(';');
    document.body.appendChild(a);
    this.newTabLink = a;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeNewTabLink());
  }

  private removeNewTabLink(): void {
    if (this.newTabLink) {
      this.newTabLink.remove();
      this.newTabLink = null;
    }
  }
}
