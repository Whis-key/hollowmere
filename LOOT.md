# Hollowmere loot reference

Generated from `index.html` at version **6.2**. Do not hand-edit — regenerate with `node loot-sheet.js index.html > LOOT.md`.

## How a drop is decided

1. **Guaranteed drops** (`drop`) are always given.
2. **Loot refs** (`loot`, or `unique` on a boss) each roll independently at their own chance `c`.
3. A ref that hits resolves **one** outcome from its table, picked by weight.
4. A table entry may be an item, a **nested table**, or an **empty slot** that pays nothing.
5. The **Ring of Fortune** removes empty slots from every table while worn.

So a ref's real drop chance is `c` × the share of its table that isn't empty.

## Tables

### Herb table — `herb_low`

Total weight 100. Pays out **100.00%** of rolls (**100.00%** with Ring of Fortune).

| outcome | weight | per roll | with ring | value |
|---|---|---|---|---|
| Grimy bitterleaf | 70 | 70.00% | 70.00% | 25 gp |
| Grimy marshroot | 30 | 30.00% | 30.00% | 60 gp |

Average value per roll: **36 gp** (**36 gp** with ring).

### Herb table — `herb_mid`

Total weight 100. Pays out **100.00%** of rolls (**100.00%** with Ring of Fortune).

| outcome | weight | per roll | with ring | value |
|---|---|---|---|---|
| Grimy marshroot | 55 | 55.00% | 55.00% | 60 gp |
| Grimy emberwort | 35 | 35.00% | 35.00% | 130 gp |
| Grimy sunthistle | 10 | 10.00% | 10.00% | 280 gp |

Average value per roll: **107 gp** (**107 gp** with ring).

### Herb table — `herb_high`

Total weight 100. Pays out **99.31%** of rolls (**100.00%** with Ring of Fortune).

| outcome | weight | per roll | with ring | value |
|---|---|---|---|---|
| Grimy emberwort | 40 | 40.00% | 40.00% | 130 gp |
| Grimy sunthistle | 40 | 40.00% | 40.00% | 280 gp |
| Grimy frostvein | 18 | 18.00% | 18.00% | 600 gp |
| → Gem table (`gem`) | 2 | — | — | — |

Including the nested route, one paying roll yields:

| item | per roll | with ring |
|---|---|---|
| Grimy emberwort | 40.00% | 40.00% |
| Grimy sunthistle | 40.00% | 40.00% |
| Grimy frostvein | 18.00% | 18.00% |
| Uncut sapphire | 0.80% | 1.21% |
| Uncut emerald | 0.34% | 0.52% |
| Uncut ruby | 0.17% | 0.26% |
| Uncut diamond | 0.004% | 0.008% |

Average value per roll: **277 gp** (**279 gp** with ring).

### Gem table — `gem`

Total weight 152. Pays out **65.46%** of rolls (**100.00%** with Ring of Fortune).

| outcome | weight | per roll | with ring | value |
|---|---|---|---|---|
| _empty slot_ | 52 | — | — | — |
| Uncut sapphire | 60 | 39.80% | 60.60% | 180 gp |
| Uncut emerald | 25 | 17.02% | 26.05% | 420 gp |
| Uncut ruby | 12 | 8.42% | 12.96% | 1,100 gp |
| → Rich gem table (`gem_rich`) | 3 | — | — | — |

Including the nested route, one paying roll yields:

| item | per roll | with ring |
|---|---|---|
| Uncut sapphire | 39.80% | 60.60% |
| Uncut emerald | 17.02% | 26.05% |
| Uncut ruby | 8.42% | 12.96% |
| Uncut diamond | 0.21% | 0.39% |

Average value per roll: **242 gp** (**372 gp** with ring).

### Rich gem table — `gem_rich`

Total weight 120. Pays out **83.33%** of rolls (**100.00%** with Ring of Fortune).

| outcome | weight | per roll | with ring | value |
|---|---|---|---|---|
| _empty slot_ | 20 | — | — | — |
| Uncut sapphire | 20 | 16.67% | 20.00% | 180 gp |
| Uncut emerald | 35 | 29.17% | 35.00% | 420 gp |
| Uncut ruby | 32 | 26.67% | 32.00% | 1,100 gp |
| Uncut diamond | 13 | 10.83% | 13.00% | 2,800 gp |

Average value per roll: **749 gp** (**899 gp** with ring).

## Sources


### Monsters

| source | table | access `c` | real chance | odds | avg gp |
|---|---|---|---|---|---|
| Giant rat (lvl 2) | Herb table (`herb_low`) | 3.00% | 3.00% | 1 in 33 | 1 |
| Goblin (lvl 8) | Herb table (`herb_low`) | 5.00% | 5.00% | 1 in 20 | 2 |
| Bandit (lvl 18) | Herb table (`herb_low`) | 5.00% | 5.00% | 1 in 20 | 2 |
| Dire wolf (lvl 30) | Herb table (`herb_mid`) | 9.00% | 9.00% | 1 in 11 | 10 |
| Bog ghast (lvl 39) | Herb table (`herb_mid`) | 8.00% | 8.00% | 1 in 13 | 9 |
| Cave troll (lvl 48) | Herb table (`herb_mid`) | 10.50% | 10.50% | 1 in 10 | 11 |
| Ember shade (lvl 60) | Herb table (`herb_high`) | 9.00% | 8.94% | 1 in 11 | 25 |
| Barrow wraith (lvl 70) | Herb table (`herb_high`) | 10.50% | 10.43% | 1 in 10 | 29 |
| Void revenant (lvl 82) | Herb table (`herb_high`) | 11.00% | 10.92% | 1 in 9 | 30 |
| Starless wyrm (lvl 92) | Herb table (`herb_high`) | 12.00% | 11.92% | 1 in 8 | 33 |
| Starless wyrm (lvl 92) | Rich gem table (`gem_rich`) | 3.00% | 2.50% | 1 in 40 | 22 |

### Bosses

| source | table | access `c` | real chance | odds | avg gp |
|---|---|---|---|---|---|
| The Sunken Warden (lvl 55) | Warden's blade | 28.00% | 28.00% | 1 in 4 | 5040 |
| Molten Tyrant (lvl 78) | Tyrant platebody | 22.00% | 22.00% | 1 in 5 | 6600 |
| The Hollow King (lvl 99) | Crown of Hollowmere | 16.00% | 16.00% | 1 in 6 | 19200 |
| The Starless Progenitor (lvl 118) | Wyrmscale aegis | 15.00% | 15.00% | 1 in 7 | 6000 |
| The Starless Progenitor (lvl 118) | Amulet of the Starless | 10.00% | 10.00% | 1 in 10 | 5500 |

### Dungeon clears

| source | table | access `c` | real chance | odds | avg gp |
|---|---|---|---|---|---|
| The Sunken Vaults (5 floors) | Ring of Vigour | 20.00% | 20.00% | 1 in 5 | 5200 |
| Emberdeep (7 floors) | Ring of Warding | 17.00% | 17.00% | 1 in 6 | 5780 |
| The Hollow Spire (10 floors) | Ring of Fortune | 14.00% | 14.00% | 1 in 7 | 8400 |

### Skilling

| source | table | access `c` | real chance | odds | avg gp |
|---|---|---|---|---|---|
| Mining — Iron vein (lvl 15) | Gem table (`gem`) | 0.90% | 0.59% | 1 in 170 | 2 |
| Mining — Coal seam (lvl 30) | Gem table (`gem`) | 1.70% | 1.11% | 1 in 90 | 4 |
| Mining — Cobalt vein (lvl 50) | Gem table (`gem`) | 4.10% | 2.68% | 1 in 37 | 10 |
| Mining — Adamant vein (lvl 70) | Rich gem table (`gem_rich`) | 3.00% | 2.50% | 1 in 40 | 22 |
| Mining — Starsteel vein (lvl 85) | Rich gem table (`gem_rich`) | 7.50% | 6.25% | 1 in 16 | 56 |
| Thieving — Gem stall (lvl 40) | Gem table (`gem`) | 4.40% | 2.88% | 1 in 35 | 11 |
| Thieving — Pickpocket noble (lvl 55) | Rich gem table (`gem_rich`) | 4.20% | 3.50% | 1 in 29 | 31 |
| Thieving — Rob the vault (lvl 75) | Rich gem table (`gem_rich`) | 15.00% | 12.50% | 1 in 8 | 112 |

### Random events

Not tied to any table. `maybeEvent()` fires on **1 in 250** completed actions of *any* kind — including rocks that have no loot ref at all.

| event | gives | chance per action |
|---|---|---|
| A travelling merchant tips you | gold | 1 in 1,000 |
| You find a coin purse in the dirt | gold | 1 in 1,000 |
| A stranger hands you a gem | Uncut sapphire | 1 in 1,000 |
| You unearth an old cache | Uncut emerald | 1 in 1,000 |

**This is why gems appear while mining copper.** A gem event is 1 in 500 actions, so a 6-second rock produces one roughly every 50 minutes regardless of the rock.

## Expected wait, skilling only

Base action times, before any tool speed bonus. Monster and boss rates depend on your kill speed, so they are left as per-kill odds above.

| action | real chance | avg wait | with ring |
|---|---|---|---|
| Mining — Iron vein (lvl 15) | 0.59% | 22 min | 14 min |
| Mining — Coal seam (lvl 30) | 1.11% | 15 min | 10 min |
| Mining — Cobalt vein (lvl 50) | 2.68% | 8 min | 5 min |
| Mining — Adamant vein (lvl 70) | 2.50% | 11 min | 9 min |
| Mining — Starsteel vein (lvl 85) | 6.25% | 6 min | 5 min |
| Thieving — Gem stall (lvl 40) | 2.88% | 4 min | 2 min |
| Thieving — Pickpocket noble (lvl 55) | 3.50% | 3 min | 3 min |
| Thieving — Rob the vault (lvl 75) | 12.50% | 1 min | 1 min |

## Rocks and actions with no loot ref

| skill | actions with a table | actions without |
|---|---|---|
| Woodcutting | — | Pine tree, Oak tree, Willow tree, Maple tree, Yew tree, Elder tree |
| Mining | 5 | Copper vein, Tin vein |
| Fishing | — | Net minnows, Bait trout, Cage perch, Harpoon sturgeon, Harpoon shark |
| Firemaking | — | Burn pine, Burn oak, Burn willow, Burn maple, Burn yew, Burn elder |
| Cooking | — | Cook minnow, Cook trout, Cook perch, Cook sturgeon, Cook shark |
| Smithing | — | Smelt bronze, Smelt iron, Smelt steel, Smelt cobalt, Smelt adamant, Smelt starsteel, Bronze sword, Iron sword, Steel sword, Cobalt sword, Adamant sword, Starsteel sword, Bronze kiteshield, Iron kiteshield, Steel kiteshield, Cobalt kiteshield, Adamant kiteshield, Starsteel kiteshield, Bronze platebody, Iron platebody, Steel platebody, Cobalt platebody, Adamant platebody, Starsteel platebody |
| Thieving | 3 | Fruit stall, Silk stall |
| Crafting | — | Tan wolf pelt, Leather coif, Cure hard leather, Hard leather coif, Studded coif, Cut sapphire, Cut emerald, Cut ruby, Cut diamond, Sapphire amulet, Emerald amulet, Ruby amulet, Diamond amulet |
| Fletching | — | Oak shortbow, Willow shortbow, Maple shortbow, Yew longbow, Elder longbow, Bronze arrows, Iron arrows, Steel arrows, Cobalt arrows, Adamant arrows, Starsteel arrows, Ember staff, Frost staff, Storm staff, Void staff |
| Runecrafting | — | Ember runes ×10, Frost runes ×10, Storm runes ×10, Void runes ×10 |
| Herblore | — | Clean bitterleaf, Clean marshroot, Clean emberwort, Clean sunthistle, Clean frostvein, Clean starbloom, Attack potion, Strength potion, Defence potion, Combat potion, Super potion |
| Prayer | — | Bury bones, Bury big bones |

Anything in the right-hand column can still produce items through the random-event path above.

## Monster stats

| foe | lvl | weak to | hp | max hit | speed | xp | gp | guaranteed | table |
|---|---|---|---|---|---|---|---|---|---|
| Giant rat | 2 | melee | 8 | 2 | 3.0s | 14 | 1–4 | 1× Bones, 1× Newt eye | Herb table (`herb_low`) |
| Goblin | 8 | ranged | 18 | 4 | 2.9s | 36 | 5–18 | 1× Bones, 1× Goblin ash | Herb table (`herb_low`) |
| Bandit | 18 | magic | 34 | 7 | 2.8s | 80 | 25–70 | 1× Bones | Herb table (`herb_low`) |
| Dire wolf | 30 | ranged | 56 | 10 | 2.5s | 150 | 50–120 | 1× Wolf pelt, 1× Bones | Herb table (`herb_mid`) |
| Bog ghast | 39 | melee | 80 | 13 | 2.8s | 230 | 80–200 | 2× Bones, 2× Newt eye | Herb table (`herb_mid`) |
| Cave troll | 48 | magic | 110 | 16 | 3.2s | 320 | 120–300 | 1× Big bones, 1× Troll fat | Herb table (`herb_mid`) |
| Ember shade | 60 | magic | 150 | 20 | 2.6s | 470 | 200–480 | 1× Big bones, 2× Goblin ash | Herb table (`herb_high`) |
| Barrow wraith | 70 | ranged | 190 | 24 | 2.7s | 640 | 280–700 | 1× Void shard, 1× Big bones, 1× Wraith dust | Herb table (`herb_high`) |
| Void revenant | 82 | melee | 240 | 28 | 2.8s | 860 | 420–980 | 2× Void shard, 2× Big bones | Herb table (`herb_high`) |
| Starless wyrm | 92 | magic | 290 | 31 | 2.7s | 1090 | 560–1250 | 3× Void shard, 3× Big bones, 2× Wraith dust | Herb table (`herb_high`), Rich gem table (`gem_rich`) |
| The Sunken Warden | 55 | magic | 420 | 22 | 2.6s | 1400 | 900–2200 | 2× Big bones, 1× Wraith dust | Warden's blade |
| Molten Tyrant | 78 | ranged | 820 | 32 | 2.4s | 3200 | 2500–6000 | 3× Big bones, 2× Troll fat | Tyrant platebody |
| The Hollow King | 99 | melee | 1600 | 44 | 2.2s | 7500 | 7000–16000 | 2× Void shard, 3× Wraith dust | Crown of Hollowmere |
| The Starless Progenitor | 118 | magic | 2800 | 58 | 2.1s | 15000 | 14000–32000 | 5× Big bones, 5× Void shard, 4× Wraith dust | Rich gem table (`gem_rich`), Wyrmscale aegis, Amulet of the Starless |
