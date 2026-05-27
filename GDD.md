# GAME DESIGN DOCUMENT (GDD)

## Working Title: *Hearthburrow*

---

# 1. High Concept

## Elevator Pitch

A cozy top-down procedural mining roguelite where players explore layered dungeon biomes, gather rare materials, rescue villagers, and gradually rebuild a ruined homeland through strategic extraction-focused expeditions.

---

# Genre

* Roguelite
* Mining Adventure
* Cozy Strategy
* Extraction Progression Game

---

# Target Platform

* Web Browser
* Desktop-first
* Future controller support

---

# Target Audience

Players who enjoy:

* Stardew Valley
* Moonlighter
* Core Keeper
* The Binding of Isaac

Particularly players seeking:

* low-pressure gameplay,
* strategic optimization,
* visible progression,
* short replayable sessions.

---

# Core Fantasy

> “Restore a forgotten village through carefully planned mining expeditions.”

---

# Core Pillars

## 1. Cozy Strategic Exploration

Relaxed pacing focused on planning and optimization rather than reflex-heavy gameplay.

## 2. Meaningful Extraction Decisions

Players constantly balance:

* stamina,
* inventory space,
* dungeon depth,
* and safe extraction.

## 3. Visible Homeland Restoration

Every successful expedition visibly repairs and expands the village.

## 4. Procedural Replayability

Procedural room layouts and events ensure every run feels fresh.

## 5. Lightweight Accessible Gameplay

Minimal mechanical complexity with high systemic depth.

---

# 2. Gameplay Overview

# Core Gameplay Loop

## Homeland Phase

Player:

* crafts tools,
* repairs equipment,
* prepares consumables,
* upgrades village structures,
* manages inventory,
* equips rings and supplies.

↓

## Expedition Phase

Player:

* enters procedural dungeon,
* explores rooms,
* mines materials,
* manages stamina,
* encounters events,
* optionally fights monsters,
* searches for safe extraction.

↓

## Extraction Phase

Player:

* extracts safely via portal/item,
  OR
* emergency teleports home with penalties.

↓

## Restoration Phase

Player:

* rebuilds village,
* unlocks NPCs,
* upgrades systems,
* expands economy,
* progresses deeper biomes.

↓

## Optimization Loop

Player improves future expedition efficiency.

---

# Session Structure

| Metric              | Target        |
| ------------------- | ------------- |
| Average Run         | 10–15 minutes |
| Homeland Management | 5–10 minutes  |
| Total Session       | 20–30 minutes |

---

# Failure Philosophy

## Soft Failure System

Failure does NOT reset progression.

Instead:

* player returns home safely,
* random found items are lost,
* permanent village progress remains intact.

This preserves:

* tension,
* experimentation,
* cozy accessibility.

---

# 3. World Structure

# Homeland

## Overview

An abandoned village serves as the persistent progression hub.

Players gradually restore:

* infrastructure,
* population,
* economy,
* and aesthetics.

---

# Homeland Buildings

| Building              | Function                      |
| --------------------- | ----------------------------- |
| Crafting Station      | Tool/item crafting            |
| Storage               | Expanded inventory management |
| Trading Post          | Unlock merchant               |
| Laboratory            | Unlock researcher             |
| Housing               | Villager capacity             |
| Farms                 | Monster-drop production       |
| Decorative Structures | Endgame beautification        |

---

# NPCs

## Merchant

* buys/sells materials,
* recipes,
* consumables.

## Researcher

* unlocks advanced systems,
* identifies special materials.

## Villagers

* rescued from dungeon,
* provide passive rewards every 5 cleared dungeon levels.

---

# Long-Term Goal

Fully restore the homeland.

Endgame progression focuses on:

* village beautification,
* relic completion,
* optimization mastery.

---

# 4. Dungeon Structure

# Biome Progression

| Biome    | Resource Focus                           |
| -------- | ---------------------------------------- |
| Forest   | Stone, low bronze chance                 |

| Cave     | Stone + bronze, low silver chance        |

| Ice Cave | Stone + bronze + silver, low gold chance |
| Lava     | All ores, low relic chance               |
| Ruins    | All ores, higher relic chance            |

---

# Dungeon Generation

## Structure Type

Grid-based procedural rooms.

## Generation Method

Hybrid procedural generation:

* handcrafted room templates,
* procedural room connections,
* procedural events,
* randomized spawns.

---

# Room Categories

| Room Type            | Purpose                   |
| -------------------- | ------------------------- |
| Standard Mining Room | Core resource gathering   |
| Puzzle Room          | Environmental interaction |
| Merchant Room        | Trading opportunities     |
| Shrine Room          | Temporary buffs           |
| Treasure Vault       | High-value loot           |
| Villager Rescue      | NPC progression           |
| Boss Room            | Biome progression         |
| Relic Chamber        | Rare endgame discovery    |

---

# Random Events

| Event                | Description               |
| -------------------- | ------------------------- |
| Wandering Trader     | Temporary merchant        |
| Gambling Goblin      | Risk/reward exchanges     |
| Hidden Treasure Room | Bonus resources           |
| Trapped Villager     | Rescue opportunity        |
| Blessing Fountain    | Temporary expedition buff |

---

# 5. Player Systems

# Controls

## Current

Keyboard-only controls.

## Planned

Future controller support.

---

# Movement

## Feel Goals

* smooth,
* relaxed,
* responsive.

Movement should encourage:

* flow-state exploration,
* route optimization.

---

# Stamina System

## Core Rule

Most actions consume stamina:

* movement,
* mining,
* interactions.

---

# Design Philosophy

Stamina is:

* a relaxed strategic limiter,
  NOT:
* a survival mechanic.

---

# Failure Conditions

## Running Out of Stamina

Player is automatically teleported home.

Penalty:

* random found items lost.

---

## Death

Player is teleported home.

Penalty:

* random found items lost.

---

## Emergency Escape

Player may manually teleport home at any time.

Penalty:

* random found items lost unless safe extraction method used.

---

# Inventory System

## Structure

Slot-based inventory.

## Design Goal

Inventory pressure should occur during most runs.

This creates:

* prioritization,
* extraction decisions,
* route optimization.

---

# Equipment Slots

| Slot    | Function            |
| ------- | ------------------- |
| Pickaxe | Mining capability   |
| Ring 1  | Combat modifiers    |
| Ring 2  | Combat modifiers    |
| Boots   | Utility/movement    |
| Lantern | Visibility resource |

---

# Lantern System

## Rules

* Lanterns are consumed per dungeon level.
* Lanterns only affect visibility.

## Design Purpose

Darkness creates:

* uncertainty,
* navigation planning,
* exploration tension.

NOT survival horror pressure.

---

# 6. Mining Systems

# Mining Philosophy

Mining should feel:

* instant,
* satisfying,
* low-friction.

---

# Mining Rules

## Tile Durability

Each tile has durability based on:

* biome,
* material rarity.

## Pickaxe Progression

Higher-tier pickaxes unlock:

* harder material types.

---

# Mining Feedback Priorities

## High Priority

* mining particles,
* item popups,
* room reveal effects.

These effects are critical to perceived polish.

---

# 7. Combat Systems

# Combat Philosophy

Combat is:

* optional,
* lightweight,
* secondary to exploration.

---

# Combat Trigger

Combat only occurs through player interaction.

---

# Combat Mechanic

Simple timing-based interaction:

* click/timing accuracy,
* reaction window,
* minimal complexity.

---

# Ring Effects

| Ring Type      | Effect                        |
| -------------- | ----------------------------- |
| Critical Ring  | Increased crit chance         |
| Damage Ring    | Bonus combat damage           |
| Precision Ring | Larger timing window          |
| Hunter Ring    | Increased monster loot chance |

---

# Boss Design

## Function

Bosses act as:

* biome gatekeepers,
* progression milestones,
* rare reward sources.

---

# Boss Rewards

| Reward Type    | Purpose             |
| -------------- | ------------------- |
| Monster Loot   | Crafting/farming    |
| Random Relics  | Endgame progression |
| Rare Materials | Post-relic rewards  |

---

# 8. Progression Systems

# Permanent Progression

| System               | Persistent? |
| -------------------- | ----------- |
| Homeland restoration | Yes         |
| Recipes              | Yes         |
| Rescued villagers    | Yes         |
| Relics discovered    | Yes         |
| Building unlocks     | Yes         |

---

# Temporary Run Progression

| Buff Type       | Example                |
| --------------- | ---------------------- |
| Efficiency Buff | Reduced stamina cost   |
| Inventory Buff  | Extra inventory slots  |
| Resource Buff   | Double ore drops       |
| Relic Buff      | Increased relic chance |

Temporary buffs disappear after expedition ends.

---

# Player Stats

| Stat                 | Function             |
| -------------------- | -------------------- |
| Max Stamina          | Expedition endurance |
| Movement Efficiency  | Lower movement cost  |
| Inventory Size       | Carry capacity       |
| Luck                 | Better drop chances  |
| Combat Timing Window | Easier combat timing |

---

# 9. Crafting & Economy

# Resource Types

| Resource      | Usage                |
| ------------- | -------------------- |
| Stone         | Construction         |
| Ore           | Equipment crafting   |
| Crystals      | Advanced crafting    |
| Monster Drops | Farming and upgrades |
| Relics        | Endgame restoration  |

---

# Crafting Philosophy

## Discovery-Based Crafting

Recipes are:

* found randomly,
* discovered through exploration,
* gradually expanded over time.

This encourages:

* curiosity,
* replayability,
* exploration.

---

# Farming System

## Purpose

Farms generate carrots used for trading.

---

# Economy

## Buyable/Sellable Items

* raw materials,
* crafted gear,
* recipes,
* consumables.

---

# Consumables

| Consumable      | Purpose                       |
| --------------- | ----------------------------- |
| Stamina Potion  | Restore stamina               |
| Teleport Scroll | Safe extraction               |
| Mining Bomb     | Break multiple tiles          |
| Food            | Temporary expedition benefits |

---

# 10. Puzzle & Interaction Systems

# Puzzle Types

| Puzzle          | Description             |
| --------------- | ----------------------- |
| Pressure Plates | Environmental unlocking |
| Pushable Rocks  | Navigation puzzles      |

---

# Interaction Variety

| Interaction | Purpose                   |
| ----------- | ------------------------- |
| Trading     | Resource exchange         |
| Gambling    | Risk/reward opportunities |

---

# 11. Art Direction

# Visual Style

## Target Style

HD-2D stylized fantasy.

### Components

* pixel-art characters,
* simple 3D environments,
* atmospheric lighting,
* stylized fantasy palettes.

---

# Art Pillars

## 1. Readability

Gameplay clarity prioritized over detail density.

## 2. Atmosphere

Lighting and environment create emotional identity.

## 3. Scope Discipline

Minimal animation complexity to preserve production feasibility.

---

# Animation Philosophy

## Style

Minimal sprite frames.

Focus:

* clarity,
* responsiveness,
* production scalability.

---

# 12. Audio Direction

# Emotional Audio Goals

* calm,
* atmospheric,
* low-pressure fantasy.

---

# Audio Layers

| Layer               | Purpose                 |
| ------------------- | ----------------------- |
| Ambient biome music | Exploration mood        |
| Mining sounds       | Satisfaction feedback   |
| Village music       | Restoration comfort     |
| Dungeon ambience    | Environmental immersion |

---

# 13. Technical Architecture

# Engine

Phaser

---

# Deployment

itch.io

---

# Procedural Generation Architecture

## Recommended Structure

* handcrafted room templates,
* procedural stitching,
* seeded generation,
* event randomization.

---

# Data Architecture

## Recommended Data-Driven Files

* rooms.json
* items.json
* relics.json
* buildings.json
* recipes.json
* events.json

---

# System Architecture

## World Systems

* dungeon generator,
* room manager,
* biome manager,
* tile manager.

## Gameplay Systems

* stamina,
* mining,
* extraction,
* inventory,
* combat.

## Meta Systems

* village progression,
* building unlocks,
* recipe database,
* relic tracking.

---

# Future Online Features

Planned future systems:

* cloud saves,
* shared market.

Not included in MVP.

---

# 14. Monetization

# Business Model

Premium game.

No:

* ads,
* pay-to-win systems,
* energy systems,
* premium currencies.

---

# 15. MVP Scope

# MVP Goal

Validate:

> “Is the mining → extraction → restoration loop satisfying?”

---

# MVP Biome

Forest biome only.

---

# MVP Features

## Dungeon

* procedural rooms,
* mining,
* stamina,
* inventory,
* extraction,
* one boss,
* one puzzle type,
* two random events.

## Homeland

* crafting station,
* storage,
* one villager house.

## Progression

* three pickaxe tiers,
* stamina upgrades,
* limited recipes.

---

# 16. Production Priorities

| Priority      | Importance |
| ------------- | ---------- |
| Replayability | Critical   |
| Visual Beauty | Critical   |
| Accessibility | Critical   |

---

# 17. Risks & Mitigation

# Risk 1 — Repetitive Gameplay

## Mitigation

* procedural events,
* temporary buffs,
* room variety,
* optimization depth.

---

# Risk 2 — Weak Mining Feedback

## Mitigation

Prioritize:

* particles,
* audio,
* loot feedback,
* reveal effects.

---

# Risk 3 — HD-2D Scope Explosion

## Mitigation

* modular environments,
* minimal animation,
* shader simplicity,
* stylized abstraction.

---

# 18. Final Vision Statement

> A replayable cozy mining roguelite focused on strategic expeditions, satisfying extraction decisions, and the emotional reward of restoring a forgotten homeland through procedural exploration and optimization mastery.

