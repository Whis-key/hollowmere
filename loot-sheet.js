/* Regenerates LOOT.md from index.html.
   Reads the real data blocks out of the game and computes the numbers, so the
   sheet cannot drift from the code. Run: node loot-sheet.js index.html > LOOT.md */
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const js = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g)
  .map(b => b.replace(/<\/?script[^>]*>/g, ''))
  .sort((a, b) => b.length - a.length)[0];

function block(re) { const m = js.match(re); if (!m) throw new Error('missing block: ' + re); return m[0]; }
const parts = [
  block(/const I=\{[\s\S]*?\n\};/),
  block(/const EQ=\{[\s\S]*?\n\};/),
  block(/const TABLES=\{[\s\S]*?\n\};/),
  block(/const g=\([\s\S]*?\);/),
  block(/const SKILLS=\{[\s\S]*?\n\};/),
  block(/const FOES=\[[\s\S]*?\n\];/),
  block(/const BOSSES=\[[\s\S]*?\n\];/),
  block(/const DUNGEONS=\[[\s\S]*?\n\];/),
  block(/const EVENTS=\[[\s\S]*?\n\];/),
];
const APP = (js.match(/const APP_VERSION='([^']+)'/) || [, '?'])[1];
// `const` inside eval stays scoped to the eval, so rebind each block globally.
eval(parts.join('\n').replace(/^const (\w+)=/gm, 'globalThis.$1='));

const name = id => (I[id] && I[id].n) || (EQ[id] && EQ[id].n) || id;
const val = id => (I[id] && I[id].v) || (EQ[id] && EQ[id].v) || 0;
const pct = x => (x * 100).toFixed(x < 0.001 ? 3 : 2) + '%';
const oneIn = x => x <= 0 ? '—' : '1 in ' + Math.round(1 / x).toLocaleString();

// --- table maths -----------------------------------------------------------
const weight = t => TABLES[t].drops.reduce((a, e) => a + (e.w || 1), 0);

// Probability of each concrete item from one roll of a table, following nests.
function resolve(t, strip, p, out, depth) {
  if (depth > 4) return out;
  let list = TABLES[t].drops;
  if (strip) list = list.filter(e => e.id || e.table);
  const tot = list.reduce((a, e) => a + (e.w || 1), 0);
  for (const e of list) {
    const q = p * (e.w || 1) / tot;
    if (e.table) resolve(e.table, strip, q, out, depth + 1);
    else if (e.id) out[e.id] = (out[e.id] || 0) + q;
    else out.__empty = (out.__empty || 0) + q;
  }
  return out;
}
const outcomes = (t, strip) => resolve(t, strip, 1, {}, 0);
const payRate = (t, strip) => 1 - (outcomes(t, strip).__empty || 0);
const evGp = (t, strip) => Object.entries(outcomes(t, strip))
  .filter(([k]) => k !== '__empty').reduce((a, [k, p]) => a + p * val(k), 0);

// --- every source that rolls loot -----------------------------------------
const sources = [];
const push = (group, label, refs, dur) => {
  for (const r of [].concat(refs || [])) if (r) sources.push({ group, label, ref: r, dur });
};
for (const f of FOES) push('Monsters', `${f.n} (lvl ${f.lvl})`, f.loot);
for (const b of BOSSES) push('Bosses', `${b.n} (lvl ${b.lvl})`, b.unique);
for (const d of DUNGEONS) push('Dungeon clears', `${d.n} (${d.floors} floors)`, { id: d.ring, c: d.ringC });
for (const k in SKILLS)
  for (const a of SKILLS[k].acts)
    if (a && a.loot) push('Skilling', `${SKILLS[k].n} — ${a.n} (lvl ${a.lvl})`, a.loot, a.dur);

const refRate = (ref, strip) => ref.table ? ref.c * payRate(ref.table, strip) : ref.c;
const refEv = (ref, strip) => ref.table ? ref.c * evGp(ref.table, strip) : ref.c * val(ref.id);
const refName = ref => ref.table ? TABLES[ref.table].n + ' (`' + ref.table + '`)' : name(ref.id);

// --- output ----------------------------------------------------------------
const L = [];
L.push(`# Hollowmere loot reference`, ``, `Generated from \`index.html\` at version **${APP}**. Do not hand-edit — regenerate with \`node loot-sheet.js index.html > LOOT.md\`.`, ``);

L.push(`## How a drop is decided`, ``,
  `1. **Guaranteed drops** (\`drop\`) are always given.`,
  `2. **Loot refs** (\`loot\`, or \`unique\` on a boss) each roll independently at their own chance \`c\`.`,
  `3. A ref that hits resolves **one** outcome from its table, picked by weight.`,
  `4. A table entry may be an item, a **nested table**, or an **empty slot** that pays nothing.`,
  `5. The **Ring of Fortune** removes empty slots from every table while worn.`,
  ``,
  `So a ref's real drop chance is \`c\` × the share of its table that isn't empty.`, ``);

L.push(`## Tables`, ``);
for (const t in TABLES) {
  const o = outcomes(t, false), oR = outcomes(t, true);
  L.push(`### ${TABLES[t].n} — \`${t}\``, ``);
  L.push(`Total weight ${weight(t)}. Pays out **${pct(payRate(t, false))}** of rolls (**${pct(payRate(t, true))}** with Ring of Fortune).`, ``);
  L.push(`| outcome | weight | per roll | with ring | value |`, `|---|---|---|---|---|`);
  for (const e of TABLES[t].drops) {
    const label = e.table ? `→ ${TABLES[e.table].n} (\`${e.table}\`)` : e.id ? name(e.id) : '_empty slot_';
    const key = e.table ? null : e.id;
    const p = key ? o[key] : null, pR = key ? oR[key] : null;
    L.push(`| ${label} | ${e.w || 1} | ${key ? pct(p) : '—'} | ${key ? pct(pR) : '—'} | ${key ? val(key).toLocaleString() + ' gp' : '—'} |`);
  }
  const nested = TABLES[t].drops.some(e => e.table);
  if (nested) {
    L.push(``, `Including the nested route, one paying roll yields:`, ``);
    L.push(`| item | per roll | with ring |`, `|---|---|---|`);
    for (const k of Object.keys(o).filter(k => k !== '__empty').sort((a, b) => o[b] - o[a]))
      L.push(`| ${name(k)} | ${pct(o[k])} | ${pct(oR[k] || 0)} |`);
  }
  L.push(``, `Average value per roll: **${evGp(t, false).toFixed(0)} gp** (**${evGp(t, true).toFixed(0)} gp** with ring).`, ``);
}

L.push(`## Sources`, ``);
let group = null;
for (const s of sources) {
  if (s.group !== group) {
    group = s.group;
    L.push(``, `### ${group}`, ``, `| source | table | access \`c\` | real chance | odds | avg gp |`, `|---|---|---|---|---|---|`);
  }
  const r = refRate(s.ref, false);
  L.push(`| ${s.label} | ${refName(s.ref)} | ${pct(s.ref.c)} | ${pct(r)} | ${oneIn(r)} | ${refEv(s.ref, false).toFixed(0)} |`);
}
L.push(``);

L.push(`### Random events`, ``,
  `Not tied to any table. \`maybeEvent()\` fires on **1 in 250** completed actions of *any* kind — including rocks that have no loot ref at all.`, ``);
L.push(`| event | gives | chance per action |`, `|---|---|---|`);
for (const e of EVENTS)
  L.push(`| ${e.t} | ${e.item ? name(e.item) : 'gold'} | ${oneIn(0.004 / EVENTS.length)} |`);
const gemEvents = EVENTS.filter(e => e.item).length;
L.push(``, `**This is why gems appear while mining copper.** A gem event is ${oneIn(0.004 * gemEvents / EVENTS.length)} actions, so a 6-second rock produces one roughly every ${Math.round(6 / (0.004 * gemEvents / EVENTS.length) / 60)} minutes regardless of the rock.`, ``);

L.push(`## Expected wait, skilling only`, ``,
  `Base action times, before any tool speed bonus. Monster and boss rates depend on your kill speed, so they are left as per-kill odds above.`, ``);
L.push(`| action | real chance | avg wait | with ring |`, `|---|---|---|---|`);
for (const s of sources.filter(s => s.dur)) {
  const r = refRate(s.ref, false), rR = refRate(s.ref, true);
  L.push(`| ${s.label} | ${pct(r)} | ${(s.dur / 60000 / r).toFixed(0)} min | ${(s.dur / 60000 / rR).toFixed(0)} min |`);
}
L.push(``);

L.push(`## Rocks and actions with no loot ref`, ``);
const bare = {};
for (const k in SKILLS) for (const a of SKILLS[k].acts) if (a && a.id) {
  bare[SKILLS[k].n] = bare[SKILLS[k].n] || { with: 0, without: [] };
  if (a.loot) bare[SKILLS[k].n].with++; else bare[SKILLS[k].n].without.push(a.n);
}
L.push(`| skill | actions with a table | actions without |`, `|---|---|---|`);
for (const k in bare)
  L.push(`| ${k} | ${bare[k].with || '—'} | ${bare[k].without.length ? bare[k].without.join(', ') : '—'} |`);
L.push(``, `Anything in the right-hand column can still produce items through the random-event path above.`, ``);

L.push(`## Monster stats`, ``, `| foe | lvl | weak to | hp | max hit | speed | xp | gp | guaranteed | table |`, `|---|---|---|---|---|---|---|---|---|---|`);
for (const f of FOES.concat(BOSSES)) {
  const g2 = Object.entries(f.drop || {}).map(([k, v]) => `${v}× ${name(k)}`).join(', ') || '—';
  const t = [].concat(f.loot || []).concat(f.unique || []).map(refName).join(', ') || '—';
  L.push(`| ${f.n} | ${f.lvl} | ${f.weak} | ${f.hp} | ${f.max} | ${(f.spd / 1000).toFixed(1)}s | ${f.xp} | ${f.gp[0]}–${f.gp[1]} | ${g2} | ${t} |`);
}
L.push(``);

console.log(L.join('\n'));
