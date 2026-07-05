import Phaser from 'phaser';

const MARGINS: Record<string, { l: number; r: number; t: number; b: number }> = {
  ui_panel_bg: { l: 4, r: 4, t: 4, b: 4 },
  ui_card_bg: { l: 3, r: 3, t: 3, b: 3 },
  ui_slot_bg: { l: 3, r: 3, t: 3, b: 3 },
  ui_modal_bg: { l: 4, r: 4, t: 4, b: 4 },
  ui_btn_bg: { l: 3, r: 3, t: 3, b: 3 },
  ui_btn_sm: { l: 2, r: 2, t: 2, b: 2 },
};

function create(
  scene: Phaser.Scene,
  x: number, y: number,
  w: number, h: number,
  textureKey: string,
): Phaser.GameObjects.NineSlice {
  const m = MARGINS[textureKey];
  const ns = new Phaser.GameObjects.NineSlice(
    scene, x, y, textureKey, undefined,
    w, h, m.l, m.r, m.t, m.b,
  );
  scene.sys.displayList.add(ns);
  return ns;
}

export class NineSliceBg {
  static panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.NineSlice {
    return create(scene, x, y, w, h, 'ui_panel_bg');
  }

  static card(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.NineSlice {
    return create(scene, x, y, w, h, 'ui_card_bg');
  }

  static slot(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.NineSlice {
    return create(scene, x, y, w, h, 'ui_slot_bg');
  }

  static modal(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.NineSlice {
    return create(scene, x, y, w, h, 'ui_modal_bg');
  }

  static btn(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.NineSlice {
    return create(scene, x, y, w, h, 'ui_btn_bg');
  }

  static btnSmall(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.NineSlice {
    return create(scene, x, y, w, h, 'ui_btn_sm');
  }

  static updateSize(ns: Phaser.GameObjects.NineSlice | null, w: number, h: number): void {
    if (ns) ns.setSize(w, h);
  }
}
