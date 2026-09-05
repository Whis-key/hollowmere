# Hollowmere roadmap and architecture notes

Running document. Updated as decisions are made, not as work is finished.

---

## Vision

- **OSRS-like depth** in monsters, bosses and loot — shared weighted tables, nested
  chase items, drops that take real time to see.
- **Months of progression** by the time the content is done, not hours.
- **A castle replacing the player house**, including a castle-defence mode.
- **PVP multiplayer**, added after the game is live.
- **More interactive content** generally — the game currently resolves everything on a
  timer with no moment-to-moment input.

---

## Conventions

- Ship in **stages**, each one small enough to test on its own. No big-bang drops.
- Every stage bumps `APP_VERSION` so the in-app updater sees it.
- `LOOT.md` is generated, never hand-edited — run `node loot-sheet.js index.html > LOOT.md`
  after any change to drops, tables, monsters or gear.

---

## Design rules settled so far

**Loot tables.** A table is rolled once and pays a single outcome by weight. Adding an
entry dilutes the others rather than raising the drop rate, which is what makes a table
safe to share across monsters. A ref is `{c, table}` or `{c, id}`; `c` is the access
chance, and a table entry may be an item, a nested table, or an empty slot.

**Empty slots are entries, not a smaller `c`.** The Ring of Fortune removes them, and
that effect is only expressible if the misses are things that can be taken off the table.

**Boss gear beats craftable gear of the same tier.** A drop gated at combat R must beat
what you could make around R. It does *not* have to beat the top craftable tier — the
Warden's blade and Tyrant platebody are a power spike at their own tier that starsteel
later overtakes, and that is deliberate. Raising them above starsteel would retire the
smithing ladder.

**Endgame gear comes from bosses.** Starsteel stays the crafted ceiling. Anything above
it drops. This is what gives bosses a reason to exist past smithing 90.

**Value should track power within a slot.** Still only partly applied — see open items.

**`FOES` stays sorted by level.** The slayer fallback slices the top three eligible foes
and assumes ordering.

---

## PVP foundation — read before writing new combat code

PVP is not another feature on the list. Everything else planned is additive; this one
changes where state lives. Noting it here so the cost is visible while planning, and so
new code stops making it worse.

**The blocking problem.** The entire save is `JSON.stringify(S)` in client-side storage.
Two players' stats are whatever their phones claim they are. Any PVP that matters has to
be server-authoritative, which means a backend, accounts, and a migration for existing
local saves. That work dwarfs any content stage.

**What makes it cheaper later, and costs nothing now:**

1. **Route randomness through one helper.** There are 21 direct `Math.random()` calls.
   A single `rng()` seam lets a fight later be replayed from a seed, which is what
   server validation and fight logs need. Cheap to adopt for new code, mechanical to
   backfill.
2. **Combat should take combatants, not read globals.** `fightTick` and friends read `S`
   directly — 268 references to `S.` across the script. A PVP fight has two combatants and
   neither of them is `S`. New combat code should take a combatant object and return a
   result, rather than reaching for `S`.
3. **Version the save.** There is no schema version in `S` today. Adding one now costs a
   line and makes every future migration — including a move to a server — tractable.
4. **Keep derived stats as pure functions.** `combatLvl()`, `maxHitFor()`, `gearBonus()`
   should compute from a passed-in combatant. Same argument as (2).

**Convention from here on:** new combat and stat code takes what it needs as arguments
and calls `rng()`. Not a refactor stage — just a rule for new code, so the eventual
refactor is small instead of total.

**Castle** is far cheaper than PVP. Rooms already have tiers and effects, so it is largely
renaming plus new room types. Castle defence is a new combat mode built on existing
pieces. It does not need the server work.

---

## Stage log

| version | what shipped |
|---|---|
| 5.3 | Slayer task floor (`cl-25`), rare drop rolls on monsters |
| 5.4 | Slot-based bank, quantity picker for vendor and list |
| 5.5 | Quantity picker extended to shop and exchange buying |
| 5.6 | Quantity strip wraps instead of overflowing the page |
| 5.7 | Shared weighted loot tables, one roller for every drop path |
| 5.8 | Nested tables, empty slots, Ring of Fortune strips them, exchange price panel |
| 5.9 | Potion selection fixed — attack potions were unreachable |
| 6.0 | Bog ghast (39) and Ember shade (60); herblore secondary supply fixed |
| 6.1 | Post-70 foes; fixed five mining gem drops dead since 5.7 |
| 6.2 | The Starless Progenitor, Wyrmscale aegis, Amulet of the Starless, repricing |

---

## Next

1. **Fourth dungeon (6.3).** Undecided — dungeons only drop rings,
   and there are already three rings for one slot. What should a dungeon give?
2. **Quests and the achievement diary, together.** They share `questState()`'s requirement
   checks, so building them in one pass avoids two requirement engines that drift apart.
   Both want the content to exist first, which it now largely does.
3. **More quests** — the current seven are thin for the amount of content behind them.

## Open items

- **Warden's blade and Tyrant platebody are still priced above the stronger starsteel
  items** — 1.20x and 1.25x, down from 2.00x. A strict value-tracks-power price would be
  12,500 and 21,500. Left at 18,000 and 30,000 pending a decision on how much the boss
  gold faucet should be cut.
- **Potion strength is melee-only, and that is deliberate.** `maxHitFor` gates
  `buffTotal('str')` behind `st==='melee'` while gear and ammo strength apply to every
  style, which reads like an oversight. It is load-bearing. At level 99 with best gear and
  prayer, max hits are melee 36 (potted), ranged 38, magic 36 — within two points. Remove
  the gate and it becomes melee 36, ranged 41, magic 38, making ranged clearly best and
  melee worst, because ranged already gets +56 from Starsteel arrows on top of its bow.
  Do not "fix" this in isolation; it only moves if all three styles are rebalanced together.
- **Melee has no weak-to target above level 39** among regular foes.
- **Smithing 92–99 has no content**, and neither does crafting above 70.
- **Copper and tin have no loot ref.** Consistent with low-tier thieving, but worth a
  decision.
