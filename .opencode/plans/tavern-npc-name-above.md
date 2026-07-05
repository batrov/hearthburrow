# Move NPC name above sprite, exclude from bob animation

## Changes in `src/scenes/TavernScene.ts`

### 1. Add tracking array (line ~85, after `npcBaseFlip`)
```typescript
private npcLabelTexts: Phaser.GameObjects.Text[] = [];
```

### 2. Reset in `create()` (line ~113, alongside other resets)
```typescript
this.npcLabelTexts = [];
```

### 3. Cleanup at start of `createNPCs()` (line ~252, alongside existing cleanups)
```typescript
this.npcLabelTexts.forEach(t => t.destroy());
this.npcLabelTexts = [];
```

### 4. Replace label creation (lines 289-292)
**Old** (inside container, below sprite at y=16):
```typescript
const label = createText(this, 0, 16, npc.name, {
  fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
}).setOrigin(0.5);
container.add(label);
```

**New** (scene-level, above sprite at pos.y - 30, not affected by bob):
```typescript
const label = createText(this, pos.x, pos.y - 30, npc.name, {
  fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
}).setOrigin(0.5).setDepth(50);
this.hudCam.ignore(label);
this.npcLabelTexts.push(label);
```

### Result
- Label sits 30px above the NPC sprite center
- Bob animation only affects the container+sprite, label stays still
- Label at depth 50 (above interactive tiles, matching HUD level)
