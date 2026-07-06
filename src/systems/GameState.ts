import { InventorySystem } from './InventorySystem';
import { CraftingSystem } from './CraftingSystem';
import { probeStorage } from './Platform';

const SAVE_KEY = 'hearthburrow_save';

export interface NPCPersonality {
  name: string;
  archetype: string;
  rescueLine: string;
  greetings: string[];
  description: string;
}

export const NPC_PERSONALITIES: NPCPersonality[] = [
  {
    name: 'Mila',
    archetype: 'Botanist',
    rescueLine: 'I was cataloging glowing moss when the floor collapsed! My specimen journal — did you see it anywhere?',
    greetings: [
      'The fungi down here glow in patterns I\'ve never documented before.',
      'I found a root that blooms only in absolute darkness.',
      'Every floor has its own ecosystem. Remarkable, really.',
    ],
    description: 'A botanist who ventured too deep studying rare dungeon flora.',
  },
  {
    name: 'Finn',
    archetype: 'Wannabe Warrior',
    rescueLine: 'I had that goblin right where I wanted him! ...Okay, maybe he had me. But I put up a fight!',
    greetings: [
      'Next time I\'m bringing a real sword. This rusted thing is useless.',
      'I\'ve been practicing my stance. Watch this! ...No, don\'t watch.',
      'The slimes aren\'t so tough once you know their rhythm.',
    ],
    description: 'An aspiring adventurer with more courage than skill.',
  },
  {
    name: 'Bram',
    archetype: 'Miner',
    rescueLine: 'Tunnel collapsed on me while I was chasing a silver vein. Happens to the best of us, eh?',
    greetings: [
      'I can smell ore from three rooms away. It\'s a gift.',
      'The rock on floor 8 has a distinct red tint. Rich in iron.',
      'If you ever need to read a tunnel wall, come find me.',
    ],
    description: 'A seasoned miner who knows every rock and vein by feel.',
  },
  {
    name: 'Nori',
    archetype: 'Halfling Cook',
    rescueLine: 'I was looking for cave truffles for my signature stew! Now my pot\'s gone cold...',
    greetings: [
      'I\'ve improvised a kitchen in the back. The mushroom broth is coming along.',
      'If you bring me cave herbs, I\'ll make you something warm.',
      'The trick to a good dungeon stew is patience and a strong stomach.',
    ],
    description: 'A cheerful cook always hunting for rare ingredients.',
  },
  {
    name: 'Tess',
    archetype: 'Scout',
    rescueLine: 'Ambushed by a patrol of rats. I held them off for hours! ...Okay, maybe minutes.',
    greetings: [
      'I\'ve sketched a map of the upper floors from memory.',
      'The monsters have patrol routes. You can learn to predict them.',
      'I spotted a hidden passage on floor 3. We should check it out.',
    ],
    description: 'A sharp-eyed scout with an instinct for danger.',
  },
  {
    name: 'Kael',
    archetype: 'Runaway Mage',
    rescueLine: 'The teleportation spell was supposed to land me in the capital, not a slime pit. Don\'t tell my master.',
    greetings: [
      'I\'ve been experimenting with a new cantrip. Watch this — okay, that wasn\'t supposed to smoke.',
      'The magical resonance down here is chaotic. I love it.',
      'I could teach you a simple light spell. If you promise not to laugh.',
    ],
    description: 'A talented but accident-prone mage with more ambition than precision.',
  },
  {
    name: 'Rin',
    archetype: 'Archaeologist',
    rescueLine: 'I found a door covered in ancient runes! I touched it and — well — the floor disappeared.',
    greetings: [
      'The architecture on floor 6 is clearly pre-empire. Fascinating.',
      'I\'ve been transcribing the runes from that sealed chamber.',
      'This dungeon was built for a purpose. I intend to find out what.',
    ],
    description: 'An archaeologist obsessed with the dungeon\'s forgotten origins.',
  },
  {
    name: 'Hugo',
    archetype: 'Merchant',
    rescueLine: 'Ambushed on the trade route! My cart, my goods — everything\'s gone. At least I still have my wits.',
    greetings: [
      'I\'ve set up a small trade post in the corner. Prices are fair!',
      'Supply and demand, my friend. Everything has a price down here.',
      'If you find anything shiny, I know a buyer.',
    ],
    description: 'A traveling merchant who can sell sand in a desert.',
  },
  {
    name: 'Lira',
    archetype: 'Bard',
    rescueLine: 'I came down here looking for inspiration for my next ballad. Got a bit more than I bargained for!',
    greetings: [
      'I\'ve written a song about your exploits. It needs work.',
      'The acoustics in the main hall are incredible for lute practice.',
      'Every hero needs a bard to sing their deeds. That\'s where I come in.',
    ],
    description: 'A wandering bard seeking the song that will define her career.',
  },
  {
    name: 'Dorn',
    archetype: 'Blacksmith',
    rescueLine: 'I was hunting for deep-crystal ore when a rockfall trapped me. Found this nice chunk, though!',
    greetings: [
      'I\'ve set up a makeshift forge. The bellows need work.',
      'That ore you brought back has excellent carbon content.',
      'If you have the materials, I can sharpen your tools.',
    ],
    description: 'A gruff blacksmith who judges ore quality at a glance.',
  },
  {
    name: 'Elara',
    archetype: 'Healer',
    rescueLine: 'I followed an injured adventurer down to help them. They made it out. I didn\'t. No regrets.',
    greetings: [
      'Let me check that wound. I\'ve seen worse, but not by much.',
      'I\'ve been stockpiling herbs for poultices. The work never ends.',
      'You push yourself too hard. Even heroes need rest.',
    ],
    description: 'A selfless healer who puts others before herself.',
  },
  {
    name: 'Sage',
    archetype: 'Librarian',
    rescueLine: 'I was looking for the dungeon\'s archive. They say the original builders left records. I found monsters instead.',
    greetings: [
      'I\'ve started a library in the corner. Donations welcome.',
      'The oral histories of the rescued tell a pattern. I\'m recording it.',
      'Knowledge is the sharpest weapon against the dark.',
    ],
    description: 'A bookish scholar trying to document the dungeon\'s secrets.',
  },
  {
    name: 'Pip',
    archetype: 'Tinkerer',
    rescueLine: 'My mining drill broke down and I got cornered. If I\'d had my tools, I could\'ve fixed it!',
    greetings: [
      'I\'ve been building a device that maps rooms automatically.',
      'If you bring me scrap metal, I can make something useful.',
      'The prototype exploded. That means progress!',
    ],
    description: 'An inventive tinkerer who believes every problem has a mechanical solution.',
  },
  {
    name: 'Zara',
    archetype: 'Rogue',
    rescueLine: 'Picked the wrong lock. Behind it was a nest of giant spiders. Note to self: check for webs first.',
    greetings: [
      'The locked rooms on floor 4 have good loot. I may have... investigated.',
      'Traps are just puzzles with sharper consequences.',
      'I never stole from anyone here. The dungeon provides.',
    ],
    description: 'A nimble rogue who can charm or pick her way through anything.',
  },
  {
    name: 'Grom',
    archetype: 'Survivalist',
    rescueLine: 'I\'ve been down here for weeks. Lost count of the days. Learned to fight, eat, sleep with one eye open.',
    greetings: [
      'The deep floors have their own rules. You learn or you die.',
      'I\'ve been tanning monster hides. Makes for warm bedding.',
      'Never drink standing water from floor 7. Trust me.',
    ],
    description: 'A rugged survivalist who adapted to the dungeon better than most.',
  },
  {
    name: 'Lana',
    archetype: 'Herbalist / Alchemist',
    rescueLine: 'I was testing a new potion recipe. The fumes attracted every monster in the vicinity. Oops.',
    greetings: [
      'That batch of stamina tonic is almost ready. Don\'t volunteer as a tester.',
      'Crystal dust, when properly refined, makes an excellent reagent.',
      'I mixed something new yesterday. Either a breakthrough or a disaster.',
    ],
    description: 'An alchemist whose experiments are as dangerous as the dungeon itself.',
  },
  {
    name: 'Moss',
    archetype: 'Druid / Hermit',
    rescueLine: 'The spirits of the deep led me here. They said I was needed. They didn\'t mention the teeth.',
    greetings: [
      'I can feel the dungeon breathing. It\'s alive, you know.',
      'The stones remember those who built this place.',
      'I\'ve been communing with the earth. It has much to say.',
    ],
    description: 'A quiet druid who hears the whispers of the ancient stone.',
  },
  {
    name: 'Ivy',
    archetype: 'Ranger / Tracker',
    rescueLine: 'I was tracking a wounded beast when the trail led into an ambush. Should\'ve seen it coming.',
    greetings: [
      'I\'ve charted the monster migration patterns on the upper floors.',
      'There\'s a pack of slimes that moves between floors through cracks in the rock.',
      'I\'ve been training a cave lizard to scout ahead. She learns fast.',
    ],
    description: 'A skilled ranger who reads the dungeon like a living forest.',
  },
  {
    name: 'Ash',
    archetype: 'Survivor / Cursed',
    rescueLine: 'Don\'t come near me! ...I think the curse wore off. Probably. Stay back just in case.',
    greetings: [
      'The dungeon left its mark on me. I\'m still figuring out what changed.',
      'I can sense monsters before they appear. A gift and a curse.',
      'Some days I miss the silence of the deep floors. That worries me.',
    ],
    description: 'A quiet soul marked by a dungeon curse that changed them forever.',
  },
  {
    name: 'Wren',
    archetype: 'Messenger / Scout',
    rescueLine: 'I volunteered to deliver supplies to an outpost. Got lost, got attacked, got rescued. Embarrassing.',
    greetings: [
      'I can carry messages between floors if you need. I know the safe paths now.',
      'The network of survivors is growing. I help keep us connected.',
      'I\'ve memorized the patrol patterns of the floor 2 monsters.',
    ],
    description: 'A swift and reliable messenger who connects the rescued community.',
  },
];

const NPC_NAMES = NPC_PERSONALITIES.map(p => p.name);

export interface RescuedVillager {
  variant: number;
  rescuedAtDepth: number;
  name: string;
  talkCount: number;
}

/** Result of a completed expedition run — items gained/lost and extract method. */
export interface RunResult {
  itemsObtained: { id: string; quantity: number }[];
  itemsLost: { id: string; quantity: number }[];
  extractType: 'safe' | 'emergency';
  depth: number;
  villagersRescued: { variant: number; name: string }[];
  recipesDiscovered: string[];
  stepsTaken: number;
  farmYield: number;
}

const ITEM_NAMES: Record<string, string> = {
  stone: 'Stone',
  bronze_ore: 'Bronze Ore',
  silver_ore: 'Silver Ore',
  gold_ore: 'Gold Ore',
  crystal: 'Crystal',
  monster_drop: 'Monster Essence',
  carrot: 'Carrot',
  stamina_potion: 'Stamina Potion',
  teleport_scroll: 'Teleport Scroll',
  mining_bomb: 'Mining Bomb',
  ring_critical: 'Critical Ring',
  ring_damage: 'Damage Ring',
  ring_precision: 'Precision Ring',
  ring_hunter: 'Hunter Ring',
  pickaxe_1: 'Common Pickaxe',
  pickaxe_2: 'Bronze Pickaxe',
  pickaxe_3: 'Silver Pickaxe',
  pickaxe_4: 'Gold Pickaxe',
  boots_stamina_bronze: 'Stamina Boots (Bronze)',
  boots_stamina_silver: 'Stamina Boots (Silver)',
  boots_stamina_gold: 'Stamina Boots (Gold)',
  boots_luck_bronze: 'Luck Boots (Bronze)',
  boots_luck_silver: 'Luck Boots (Silver)',
  boots_luck_gold: 'Luck Boots (Gold)',
  boots_regen: 'Regenerative Boots',
  lantern_bronze: 'Bronze Lantern',
  lantern_silver: 'Silver Lantern',
  lantern_gold: 'Gold Lantern',
  miners_spirit: "Miner's Spirit",
  miners_potion: "Miner's Potion",
  forest_gem: 'Forest Gem',
  cave_heart: 'Cave Heart',
  ice_shard: 'Ice Shard',
  magma_core: 'Magma Core',
  void_essence: 'Void Essence',
  cursed_doll: 'Cursed Doll',
};

/** Get the human-readable display name for an item ID. Falls back to replacing underscores with spaces. */
export function itemDisplayName(id: string): string {
  return ITEM_NAMES[id] ?? id.replace(/_/g, ' ');
}

/** Get the texture key for an item icon. Uses ore drop sprites where available, otherwise item_<id>. */
export function itemIconKey(id: string): string {
  const oreItems = ['stone', 'bronze_ore', 'silver_ore', 'gold_ore', 'crystal'];
  if (oreItems.includes(id)) return id.endsWith('_ore') ? id : `${id}_ore`;
  if (id === 'monster_drop') return 'monster_drop_ore';
  return `item_${id}`;
}

const DISPLAY_NAME_TO_ID = Object.fromEntries(
  Object.entries(ITEM_NAMES).map(([id, name]) => [name, id])
);

/** Reverse lookup: get the item ID for a display name (e.g. 'Stamina Potion' → 'stamina_potion'). */
export function itemIdFromDisplayName(name: string): string | undefined {
  return DISPLAY_NAME_TO_ID[name];
}

const MAX_PICKAXE_RUNS = 5;
const MAX_EQUIP_RUNS = 5;

export class GameState {
  /** Probes localStorage at module load time — catches Safari private browsing SecurityError. */
  static readonly storageAvailable: boolean = probeStorage();

  inventory: InventorySystem;
  crafting: CraftingSystem;
  lastRunResult: RunResult | null = null;
  restoredBuildings: Set<string>;
  currentPickaxeTier: number;
  maxStaminaBonus: number;
  staminaPercentBonus: number;
  inventorySlotBonus: number;
  playerLevel: number;
  playerXp: number;
  pickaxeRuns: Record<number, number>;
  equippedRings: { ring1: string | null; ring2: string | null };
  equippedBoots: string | null;
  equippedLantern: string | null;
  itemRuns: Record<string, number>;
  farmPlanted: number;
  farmHarvest: number;
  researchLevels: Record<string, number>;
  monsterKills: { slime: number; rat: number; bat: number };
  villagersRescued: number;
  rescuedVillagers: RescuedVillager[];
  villagerRescueFloors: Set<number>;
  foundRelics: string[];
  maxDepthReached: number;
  exhaustionCount: number;
  craftedItems: Set<string>;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  currentRunSeed: string;
  runVillagersRescued: { variant: number; name: string }[];
  runRecipesDiscovered: string[];

  constructor() {
    this.inventory = new InventorySystem(32);
    this.crafting = new CraftingSystem();
    this.restoredBuildings = new Set();
    this.currentPickaxeTier = 1;
    this.maxStaminaBonus = 0;
    this.staminaPercentBonus = 0;
    this.inventorySlotBonus = 0;
    this.playerLevel = 1;
    this.playerXp = 0;
    this.pickaxeRuns = {};
    this.equippedRings = { ring1: null, ring2: null };
    this.equippedBoots = null;
    this.equippedLantern = null;
    this.itemRuns = {};
    this.farmPlanted = 0;
    this.farmHarvest = 0;
    this.researchLevels = {};
    this.monsterKills = { slime: 0, rat: 0, bat: 0 };
    this.villagersRescued = 0;
    this.rescuedVillagers = [];
    this.villagerRescueFloors = new Set();
    this.foundRelics = [];
    this.maxDepthReached = 0;
    this.exhaustionCount = 0;
    this.craftedItems = new Set();
    this.masterVolume = 1;
    this.musicVolume = 0.4;
    this.sfxVolume = 0.6;
    this.currentRunSeed = '';
    this.runVillagersRescued = [];
    this.runRecipesDiscovered = [];
  }

  /** Get the current research level for a project (0 if not started). */
  getResearchLevel(id: string): number {
    return this.researchLevels[id] ?? 0;
  }

  /** Set the research level for a project. */
  setResearchLevel(id: string, level: number): void {
    this.researchLevels[id] = level;
  }

  /** Add XP and return the number of levels gained. */
  addXp(amount: number): number {
    this.playerXp += amount;
    let levels = 0;
    while (this.playerXp >= this.getXpToNextLevel()) {
      this.playerXp -= this.getXpToNextLevel();
      this.playerLevel++;
      levels++;
    }
    if (levels > 0) this.save();
    return levels;
  }

  /** XP needed to reach the next level. */
  getXpToNextLevel(): number {
    return 50 + (this.playerLevel - 1) * 25;
  }

  /** Remaining runs for a pickaxe tier (Infinity for tier 1). */
  remainingPickaxeRuns(tier?: number): number {
    const t = tier ?? this.currentPickaxeTier;
    if (t === 1) return Infinity;
    const used = this.pickaxeRuns[t] ?? 0;
    return Math.max(0, MAX_PICKAXE_RUNS - used);
  }

  /** Set the currently equipped pickaxe tier. */
  equipPickaxe(tier: number): void {
    this.currentPickaxeTier = tier;
  }

  /** Decrement current pickaxe runs. If depleted, drops to tier 1 and removes item. */
  consumePickaxeRun(): void {
    if (this.currentPickaxeTier === 1) return;
    this.pickaxeRuns[this.currentPickaxeTier] = (this.pickaxeRuns[this.currentPickaxeTier] ?? 0) + 1;
    if ((this.pickaxeRuns[this.currentPickaxeTier] ?? 0) >= MAX_PICKAXE_RUNS) {
      const pickaxeId = `pickaxe_${this.currentPickaxeTier}`;
      this.inventory.removeItem(pickaxeId, 1);
      if (this.inventory.count(pickaxeId) === 0) {
        delete this.pickaxeRuns[this.currentPickaxeTier];
      } else {
        this.pickaxeRuns[this.currentPickaxeTier] = 0;
      }
      this.currentPickaxeTier = 1;
    }
  }

  /** Get all pickaxes the player owns (including default tier 1). */
  getAvailablePickaxes(): { id: string; tier: number }[] {
    const result: { id: string; tier: number }[] = [];
    result.push({ id: 'pickaxe_1', tier: 1 });
    for (let t = 2; t <= 4; t++) {
      const id = `pickaxe_${t}`;
      if (this.inventory.count(id) > 0) {
        result.push({ id, tier: t });
      }
    }
    return result.sort((a, b) => a.tier - b.tier);
  }

  /** Get rings available for equipment (owned + currently equipped). */
  getAvailableRings(): { id: string; name: string }[] {
    const ringIds = ['ring_critical', 'ring_damage', 'ring_precision', 'ring_hunter'];
    const result: { id: string; name: string }[] = [];
    for (const id of ringIds) {
      if (this.inventory.count(id) > 0 || this.equippedRings.ring1 === id || this.equippedRings.ring2 === id) {
        result.push({ id, name: itemDisplayName(id) });
      }
    }
    return result;
  }

  /** Sum effects from both equipped ring slots into a single result. */
  getRingEffects(): { critChance: number; bonusDamage: number; precisionMult: number; doubleLoot: boolean } {
    const effects = { critChance: 0, bonusDamage: 0, precisionMult: 1, doubleLoot: false };
    for (const slot of [this.equippedRings.ring1, this.equippedRings.ring2]) {
      switch (slot) {
        case 'ring_critical': effects.critChance += 0.2; break;
        case 'ring_damage': effects.bonusDamage += 1; break;
        case 'ring_precision': effects.precisionMult *= 1.3; break;
        case 'ring_hunter': effects.doubleLoot = true; break;
      }
    }
    return effects;
  }

  /** Get the combined effects from currently equipped boots. */
  getBootEffects(): { maxStaminaBonus: number; luckBonus: number; stairMultiplier: number } {
    switch (this.equippedBoots) {
      case 'boots_stamina_bronze': return { maxStaminaBonus: 10, luckBonus: 0, stairMultiplier: 1 };
      case 'boots_stamina_silver': return { maxStaminaBonus: 20, luckBonus: 0, stairMultiplier: 1 };
      case 'boots_stamina_gold':   return { maxStaminaBonus: 30, luckBonus: 0, stairMultiplier: 1 };
      case 'boots_luck_bronze':    return { maxStaminaBonus: 0, luckBonus: 0.10, stairMultiplier: 1.1 };
      case 'boots_luck_silver':    return { maxStaminaBonus: 0, luckBonus: 0.25, stairMultiplier: 1.25 };
      case 'boots_luck_gold':      return { maxStaminaBonus: 0, luckBonus: 0.40, stairMultiplier: 1.4 };
      default:                     return { maxStaminaBonus: 0, luckBonus: 0, stairMultiplier: 1 };
    }
  }

  /** Get visibility radius in pixels for the current lantern + dark floor status. */
  getLanternRange(depth: number): number {
    const isDarkFloor = depth > 0 && depth % 5 === 3;
    const tierRanges: Record<string, number> = {
      lantern_bronze: 3, lantern_silver: 4, lantern_gold: 5,
    };
    let bonus = this.equippedLantern ? (tierRanges[this.equippedLantern] ?? 0) : 0;
    if (this.getResearchLevel('lantern_efficiency') >= 1) bonus++;
    if (isDarkFloor) {
      return 90 + bonus * 30;
    }
    return bonus * 30;
  }

  /** Get boot effects for a specific boot ID (preview, doesn't need to be equipped). */
  getBootEffectsById(id: string | null): { maxStaminaBonus: number; luckBonus: number; stairMultiplier: number } {
    switch (id) {
      case 'boots_stamina_bronze': return { maxStaminaBonus: 10, luckBonus: 0, stairMultiplier: 1 };
      case 'boots_stamina_silver': return { maxStaminaBonus: 20, luckBonus: 0, stairMultiplier: 1 };
      case 'boots_stamina_gold':   return { maxStaminaBonus: 30, luckBonus: 0, stairMultiplier: 1 };
      case 'boots_luck_bronze':    return { maxStaminaBonus: 0, luckBonus: 0.10, stairMultiplier: 1.1 };
      case 'boots_luck_silver':    return { maxStaminaBonus: 0, luckBonus: 0.25, stairMultiplier: 1.25 };
      case 'boots_luck_gold':      return { maxStaminaBonus: 0, luckBonus: 0.40, stairMultiplier: 1.4 };
      default:                     return { maxStaminaBonus: 0, luckBonus: 0, stairMultiplier: 1 };
    }
  }

  /** Get lantern range in pixels for a specific lantern ID (preview). */
  getLanternRangeForPreview(id: string | null): number {
    const tierRanges: Record<string, number> = {
      lantern_bronze: 3, lantern_silver: 4, lantern_gold: 5,
    };
    let bonus = id ? (tierRanges[id] ?? 0) : 0;
    if (this.getResearchLevel('lantern_efficiency') >= 1) bonus++;
    return bonus * 30;
  }

  /** Get human-readable description of a ring's effect. */
  getRingDescription(id: string | null): string {
    switch (id) {
      case 'ring_critical': return '+20% crit chance';
      case 'ring_damage': return '+1 combat damage';
      case 'ring_precision': return '1.3× wider timing window';
      case 'ring_hunter': return 'Double monster loot';
      default: return '-';
    }
  }

  /** Check if an item has per-run durability (boots, lanterns). */
  hasUsageLimit(id: string): boolean {
    return id.startsWith('boots_') || id.startsWith('lantern_');
  }

  /** Remaining expeditions an equipment item can be used (max 5). */
  remainingEquipmentRuns(itemId: string): number {
    if (!this.hasUsageLimit(itemId)) return Infinity;
    return Math.max(0, MAX_EQUIP_RUNS - (this.itemRuns[itemId] ?? 0));
  }

  /** Decrement equipment run counter. Removes item + clears slot when depleted. */
  consumeEquipmentRun(itemId: string | null): void {
    if (!itemId || !this.hasUsageLimit(itemId)) return;
    this.itemRuns[itemId] = (this.itemRuns[itemId] ?? 0) + 1;
    if (this.remainingEquipmentRuns(itemId) <= 0) {
      this.inventory.removeItem(itemId, 1);
      if (this.equippedBoots === itemId) this.equippedBoots = null;
      if (this.equippedLantern === itemId) this.equippedLantern = null;
      if (this.inventory.count(itemId) > 0) {
        this.itemRuns[itemId] = 0;
      }
    }
  }

  /** Get boots available for equipping (owned or currently equipped). */
  getAvailableBoots(): { id: string; name: string; runs: number }[] {
    const bootIds = ['boots_stamina_bronze', 'boots_stamina_silver', 'boots_stamina_gold',
      'boots_luck_bronze', 'boots_luck_silver', 'boots_luck_gold', 'boots_regen'];
    const result: { id: string; name: string; runs: number }[] = [];
    for (const id of bootIds) {
      if (this.inventory.count(id) > 0 || this.equippedBoots === id) {
        result.push({ id, name: itemDisplayName(id), runs: this.remainingEquipmentRuns(id) });
      }
    }
    return result;
  }

  /** Get lanterns available for equipping (owned or currently equipped). */
  getAvailableLanterns(): { id: string; name: string; runs: number }[] {
    const lanternIds = ['lantern_bronze', 'lantern_silver', 'lantern_gold'];
    const result: { id: string; name: string; runs: number }[] = [];
    for (const id of lanternIds) {
      if (this.inventory.count(id) > 0 || this.equippedLantern === id) {
        result.push({ id, name: itemDisplayName(id), runs: this.remainingEquipmentRuns(id) });
      }
    }
    return result;
  }

  addCraftedItem(id: string): void {
    this.craftedItems.add(id);
  }

  hasCraftedItem(id: string): boolean {
    return this.craftedItems.has(id);
  }

  /** Permanently acquire a relic and apply its stat bonus (stamina, inventory, or luck). */
  addFoundRelic(id: string): void {
    if (!this.foundRelics.includes(id)) {
      this.foundRelics.push(id);
      const relicData = this.getRelicData(id);
      if (relicData) {
        switch (relicData.effect) {
          case 'max_stamina': this.maxStaminaBonus += relicData.value; break;
          case 'inventory_slots': this.inventorySlotBonus += relicData.value; break;
          case 'luck': break;
        }
      }
      this.save();
    }
  }

  /** Check if a specific relic has been found already. */
  hasFoundRelic(id: string): boolean {
    return this.foundRelics.includes(id);
  }

  /** Get list of all relics found this run. */
  getFoundRelics(): string[] {
    return [...this.foundRelics];
  }

  private getRelicData(id: string): { effect: string; value: number } | undefined {
    const map: Record<string, { effect: string; value: number }> = {
      relic_stamina: { effect: 'max_stamina', value: 20 },
      relic_inventory: { effect: 'inventory_slots', value: 4 },
      relic_luck: { effect: 'luck', value: 1 },
    };
    return map[id];
  }

  /** Get floor numbers reachable via elevator (multiples of 5 up to maxDepthReached). */
  getAvailableElevatorFloors(): number[] {
    const floors: number[] = [];
    for (let f = 0; f <= this.maxDepthReached; f += 5) {
      floors.push(f);
    }
    return floors;
  }

  /** Wipe all save data and reinitialize to defaults. */
  resetProgress(): void {
    localStorage.removeItem('hearthburrow_save');
    localStorage.removeItem('researched_upgrades');
    this.inventory = new InventorySystem(32);
    this.crafting = new CraftingSystem();
    this.restoredBuildings = new Set();
    this.currentPickaxeTier = 1;
    this.maxStaminaBonus = 0;
    this.staminaPercentBonus = 0;
    this.inventorySlotBonus = 0;
    this.playerLevel = 1;
    this.playerXp = 0;
    this.pickaxeRuns = {};
    this.equippedRings = { ring1: null, ring2: null };
    this.equippedBoots = null;
    this.equippedLantern = null;
    this.itemRuns = {};
    this.farmPlanted = 0;
    this.farmHarvest = 0;
    this.researchLevels = {};
    this.monsterKills = { slime: 0, rat: 0, bat: 0 };
    this.villagersRescued = 0;
    this.rescuedVillagers = [];
    this.villagerRescueFloors = new Set();
    this.foundRelics = [];
    this.maxDepthReached = 0;
    this.exhaustionCount = 0;
    this.craftedItems = new Set();
    this.masterVolume = 1;
    this.musicVolume = 0.4;
    this.sfxVolume = 0.6;
    this.currentRunSeed = '';
  }

  /** Persist entire game state to localStorage. */
  save(): void {
    if (!GameState.storageAvailable) return;
    const data = {
      inventory: this.inventory.getItems().map(s => s ? { itemId: s.itemId, quantity: s.quantity } : null),
      restoredBuildings: Array.from(this.restoredBuildings),
      currentPickaxeTier: this.currentPickaxeTier,
      maxStaminaBonus: this.maxStaminaBonus,
      staminaPercentBonus: this.staminaPercentBonus,
      inventorySlotBonus: this.inventorySlotBonus,
      playerLevel: this.playerLevel,
      playerXp: this.playerXp,
      pickaxeRuns: { ...this.pickaxeRuns },
      equippedRings: { ...this.equippedRings },
      equippedBoots: this.equippedBoots,
      equippedLantern: this.equippedLantern,
      itemRuns: { ...this.itemRuns },
      farmPlanted: this.farmPlanted,
      farmHarvest: this.farmHarvest,
      discovered: this.crafting.getDiscoveredIds(),
      researchLevels: { ...this.researchLevels },
      monsterKills: { ...this.monsterKills },
      villagersRescued: this.villagersRescued,
      rescuedVillagers: this.rescuedVillagers,
      villagerRescueFloors: Array.from(this.villagerRescueFloors),
      foundRelics: this.foundRelics,
      maxDepthReached: this.maxDepthReached,
      exhaustionCount: this.exhaustionCount,
      craftedItems: Array.from(this.craftedItems),
      masterVolume: this.masterVolume,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      currentRunSeed: this.currentRunSeed,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[GameState] Save failed:', e);
    }
  }

  /** Restore game state from localStorage. Handles migration from legacy formats. */
  load(): void {
    if (!GameState.storageAvailable) return;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      this.inventory = new InventorySystem(32);
      if (data.inventory) {
        for (const slot of data.inventory) {
          if (slot) this.inventory.addItem(slot.itemId, slot.quantity);
        }
      }

      this.restoredBuildings = new Set(data.restoredBuildings ?? []);
      this.currentPickaxeTier = data.currentPickaxeTier ?? 1;
      this.maxStaminaBonus = data.maxStaminaBonus ?? 0;
      this.staminaPercentBonus = data.staminaPercentBonus ?? 0;
      this.inventorySlotBonus = data.inventorySlotBonus ?? 0;
      this.playerLevel = data.playerLevel ?? 1;
      this.playerXp = data.playerXp ?? 0;
      this.pickaxeRuns = data.pickaxeRuns ?? {};
      this.equippedRings = data.equippedRings ?? { ring1: null, ring2: null };
      this.equippedBoots = data.equippedBoots ?? null;
      this.equippedLantern = data.equippedLantern ?? null;
      this.itemRuns = data.itemRuns ?? {};
      this.farmPlanted = data.farmPlanted ?? 0;
      this.farmHarvest = data.farmHarvest ?? 0;
      this.monsterKills = data.monsterKills ?? { slime: 0, rat: 0, bat: 0 };
      this.villagersRescued = data.villagersRescued ?? 0;
      this.rescuedVillagers = data.rescuedVillagers ?? [];
      // migrate: backfill talkCount for saves made before NPC personalities
      for (const v of this.rescuedVillagers) {
        if (v.talkCount === undefined) v.talkCount = 0;
      }
      this.villagerRescueFloors = new Set(data.villagerRescueFloors ?? []);
      // migrate: backfill rescuedVillagers from legacy count
      if (data.rescuedVillagers === undefined && this.villagersRescued > 0) {
        this.rescuedVillagers = [];
        for (let i = 0; i < this.villagersRescued; i++) {
          this.rescuedVillagers.push({ variant: i, rescuedAtDepth: -1, name: NPC_NAMES[i % NPC_NAMES.length], talkCount: 0 });
        }
      }
      this.foundRelics = data.foundRelics ?? [];
      this.maxDepthReached = data.maxDepthReached ?? 0;
      this.exhaustionCount = data.exhaustionCount ?? 0;
      this.craftedItems = new Set(data.craftedItems ?? []);
      this.masterVolume = data.masterVolume ?? 1;
      this.musicVolume = data.musicVolume ?? 0.4;
      this.sfxVolume = data.sfxVolume ?? 0.6;
      this.currentRunSeed = data.currentRunSeed ?? '';

      // migrate researchLevels from old format
      if (data.researchLevels && typeof data.researchLevels === 'object' && !Array.isArray(data.researchLevels)) {
        this.researchLevels = { ...data.researchLevels };
      } else if (Array.isArray(data.researchedUpgrades)) {
        // old format: convert stamina_up → stamina:1, inventory_up → backpack:1
        this.researchLevels = {};
        for (const id of data.researchedUpgrades) {
          if (id === 'stamina_up') this.researchLevels['stamina'] = 1;
          if (id === 'inventory_up') this.researchLevels['backpack'] = 1;
        }
      }

      if (data.discovered) {
        this.crafting = new CraftingSystem();
        for (const id of data.discovered) {
          this.crafting.discover(id);
        }
      }
    } catch (e) {
      console.warn('[GameState] Load failed — corrupt save, starting fresh:', e);
    }
  }
}

export const gameState = new GameState();
