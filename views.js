/* ============================================================
   RENDER
   ============================================================ */
let tab='train',openGroups=new Set();
/* Which bank row has its quantity strip open, {id,mode}. Deliberately not on S
   — it is throwaway UI state and has no business in the save file. */
let pick=null;
const $=id=>document.getElementById(id);
const fmt=n=>n>=1e6?(n/1e6).toFixed(2)+'m':n>=1e4?Math.floor(n/1e3)+'k':String(Math.round(n));

function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1900);}

function renderDoing(){
  const el=$('doing');
  if(S.stun>0){
    el.innerHTML=`<div class="doing-row"><b>Stunned</b><em>${(S.stun/1000).toFixed(1)}s</em></div>
      <div class="bar stun"><i style="width:100%"></i></div>`;return;
  }
  const cur=findAct(S.act);
  if(!cur){el.innerHTML='<div class="idlemsg">Idle — pick something to train.</div>';return;}
  if(cur.skill==='delve'){
    const f=cur.foe,pct=Math.max(0,(S.foeHp/f.hp)*100);
    el.innerHTML=`<div class="doing-row"><b>${f.n}</b><em>${S.hp}/${maxHp()} hp</em></div>
      <div class="bar fight"><i style="width:${pct}%"></i></div>`;return;
  }
  if(cur.skill==='fight'){
    const f=cur.foe,pct=Math.max(0,(S.foeHp/f.hp)*100);
    el.innerHTML=`<div class="doing-row"><b>Fighting ${f.n}</b><em>${S.hp}/${maxHp()} hp</em></div>
      <div class="bar fight"><i style="width:${pct}%"></i></div>`;return;
  }
  const{skill,a}=cur,dur=actDur(skill,a);
  el.innerHTML=`<div class="doing-row"><b>${a.n}</b>
    <em>${fmt(a.xp/(dur/1000)*3600)} xp/hr</em></div>
    <div class="bar"><i style="width:${Math.min(100,(S.prog/dur)*100)}%"></i></div>`;
}

function skillStrip(){
  return `<div class="skills">${ALL_SKILLS.map(k=>{
    const l=lvlFor(S.xp[k]||0),p=xpInto(S.xp[k]||0);
    return `<div class="sk${l>=99?' max':''}"><span class="n">${label(k)}</span>
      <span class="v num">${l}</span><div class="xpbar"><i style="width:${p.pct}%"></i></div></div>`;
  }).join('')}</div>`;
}

function actRow(key,a,ok,on){
  const dur=actDur(key,a);
  const needs=a.in?Object.keys(a.in).map(k=>`${a.in[k]}× ${item(k).n}`).join(', '):'';
  const short=a.in&&!canPay(a.in);
  const bits=[];
  if(needs)bits.push(needs+(short?' — none in bank':''));
  if(a.gp)bits.push(`${a.gp[0]}–${a.gp[1]} gp`);
  if(a.fail)bits.push(`${Math.round(a.fail*100)}% caught`);
  if(a.out&&!a.in)bits.push(Object.keys(a.out).map(k=>item(k).n).join(', '));
  return `<button class="act${on?' on':''}" ${ok?'':'disabled'} data-go="${key}:${a.id}">
    <span><span>${a.n}</span><span class="meta">${ok?(bits.join(' · ')||'—'):'Requires level '+a.lvl}</span></span>
    <span class="rt">${fmt(a.xp)} xp<br>${(dur/1000).toFixed(1)}s</span></button>`;
}

function viewTrain(){
  let h=`<h2>Levels &middot; combat ${combatLvl()}</h2>${skillStrip()}
    <h2>Equipment</h2><div class="slots">`;
  for(const sl of SLOTS){
    const id=S.equip[sl];
    h+=`<div class="slot${id?'':' none'}"><span class="n">${cap0(sl)}</span>
      <span class="v">${id?EQ[id].n:'empty'}</span></div>`;
  }
  const G=gear(),P=prayerBonus();
  h+=`</div><div class="row"><div class="grow"><b>+${G.str} strength &middot; +${G.def} defence</b>
    <span>Prayer adds +${P.hit} max hit and soaks ${P.soak} damage</span></div></div>`;

  h+=`<h2>Farm &middot; ${totalPatches()} patches</h2>`;
  const fl=lvl('farming');
  S.farm.forEach((pt,i)=>{
    if(i>=totalPatches())return;
    if(!pt.crop){
      const sown=CROPS.filter(c=>fl>=c.lvl&&have(c.seed)>0);
      h+=`<div class="patch"><div class="grow"><b>Empty patch</b>
        <span>${sown.length?'Ready to sow':'No usable seeds — buy some in the shop'}</span></div>
        ${sown.length?`<button class="mini buy" data-sow="${i}">Sow ${sown[sown.length-1].n}</button>`:''}</div>`;
    }else{
      const c=CROPS.find(x=>x.id===pt.crop),ready=pt.ms<=0;
      const pct=ready?100:(1-pt.ms/c.ms)*100;
      const mins=Math.ceil(pt.ms/60000);
      h+=`<div class="patch${ready?' ready':''}"><div class="grow"><b>${c.n}</b>
        <span>${ready?'Ready to harvest':`${mins} min remaining`}</span>
        <div class="pbar"><i style="width:${pct}%"></i></div></div>
        <button class="mini ${ready?'buy':''}" data-harvest="${i}" ${ready?'':'disabled'}>${ready?'Harvest':'Growing'}</button></div>`;
    }
  });
  h+=`<h2>Train a skill</h2>`;
  for(const key in SKILLS){
    const s=SKILLS[key],L=lvl(key);
    const open=(S.act&&S.act.startsWith(key+':'))?' open':'';
    h+=`<details class="group"${open}><summary>${s.n}<span class="lv num">lv ${L}</span></summary>`;
    for(const a of s.acts){
      if(a.sub){h+=`<div class="subhead">${a.sub}</div>`;continue;}
      h+=actRow(key,a,L>=a.lvl,S.act===key+':'+a.id);
    }
    h+=`</details>`;
  }
  h+=`<h2>Danger zone</h2><div class="row"><div class="grow"><b>Reset save</b>
    <span>Wipes everything, permanently</span></div>
    <button class="mini" data-wipe="1">Reset</button></div>`;
  return h;
}

function viewFight(){
  const G=gear(),P=prayerBonus();
  const st=style(),ammo=bestAmmo(st);
  const maxHit=maxHitFor(st,G,P,ammo);
  let h=`<div class="arena">
    <div class="hpline"><span>Your health</span><span class="num">${S.hp} / ${maxHp()}</span></div>
    <div class="hpbar"><i style="width:${(S.hp/maxHp())*100}%"></i></div>
    <div class="hpline"><span>${st} &middot; max hit ${maxHit}</span><span class="num">+${G.def} defence</span></div></div>`;
  h+=`<div class="styles">
    <div class="${st==='melee'?'act':''}"><span class="n">Melee</span><span class="v num">${lvl('attack')}/${lvl('strength')}</span></div>
    <div class="${st==='ranged'?'act':''}"><span class="n">Ranged</span><span class="v num">${lvl('ranged')}</span></div>
    <div class="${st==='magic'?'act':''}"><span class="n">Magic</span><span class="v num">${lvl('magic')}</span></div></div>`;
  if(ammoKind(st))h+=`<div class="buffs">${ammo?`Firing ${item(ammo).n} — ${fmt(have(ammo))} left`:`<span class="resist">No ${ammoKind(st)}s banked — you are swinging bare-handed</span>`}</div>`;
  const bk=Object.keys(S.buffs||{});
  if(bk.length)h+=`<div class="buffs">Active: ${bk.map(k=>`+${S.buffs[k].amt} ${k} (${Math.ceil(S.buffs[k].ms/60000)}m)`).join(' &middot; ')}</div>`;

  const ss=S.sess||{},acc=ss.swings?Math.round((ss.hits/ss.swings)*100):0;
  h+=`<h2>This session</h2><div class="sess">
    <div><span class="n">Kills</span><span class="v">${fmt(ss.kills||0)}</span></div>
    <div><span class="n">Gold</span><span class="v">${fmt(ss.gp||0)}</span></div>
    <div><span class="n">Accuracy</span><span class="v">${acc}%</span></div>
    <div><span class="n">Damage out</span><span class="v">${fmt(ss.dealt||0)}</span></div>
    <div><span class="n">Damage in</span><span class="v">${fmt(ss.taken||0)}</span></div>
    <div><span class="n">Food eaten</span><span class="v">${fmt(ss.eaten||0)}</span></div>
  </div>`;
  h+=`<h2>Bosses</h2>`;
  h+=`<div class="row"><div class="grow"><b>${have('boss_sigil')} boss sigils</b>
    <span>One is spent per attempt. Slayer tasks drop them about a third of the time.</span></div></div>`;
  for(const f of BOSSES){
    const cl=combatLvl(),locked=cl<f.req,noKey=have('boss_sigil')<1;
    const on=S.act==='fight:'+f.id;
    h+=`<button class="act${on?' on fight':''} boss" ${(locked||(noKey&&!on))?'disabled':''} data-go="fight:${f.id}">
      <span><span>${f.n}</span><span class="meta">${locked?`Needs combat ${f.req} — you are ${cl}`
        :`${f.hp} hp &middot; hits up to ${f.max} &middot; ${[].concat(f.unique||[]).map(u=>`${Math.round(u.c*100)}% ${refLabel(u)}`).join(' &middot; ')} &middot; slain ${S.bossKills[f.id]||0}
        &middot; <span class="${f.weak===st?'weak':'resist'}">weak to ${f.weak}</span>`}</span></span>
      <span class="rt">lv ${f.lvl}<br>${fmt(f.xp)} xp</span></button>`;
  }
  h+=`<h2>Dungeons</h2>`;
  if(S.delve){
    const d=DUNGEONS.find(x=>x.id===S.delve.id);
    const deep=S.delve.floor-d.floors;
    if(deep>=0){
      h+=`<div class="task"><b>In ${d.n}</b> — cleared, at depth ${deep}
        <div style="margin-top:6px;font-size:12px;color:var(--dim)">Haul ${fmt(S.delve.haulGp||0)} gp and ${fmt(S.delve.haulXp||0)} slayer xp, banked when you leave and lost if you die.
        Deep foes are frenzied: lower level so you land more hits, but they hit far harder and cut through armour. Ring roll every 5 depths. Best here: depth ${S.deepest[d.id]||0}.</div></div>`;
    }else{
      h+=`<div class="task"><b>In ${d.n}</b> — floor ${S.delve.floor+1} of ${d.floors}
        <div style="margin-top:6px;font-size:12px;color:var(--dim)">Dying forfeits the completion bonus. Floors do not heal you.</div></div>`;
    }
  }
  for(const d of DUNGEONS){
    const cl=combatLvl(),locked=cl<d.req,on=S.delve&&S.delve.id===d.id;
    h+=`<button class="act${on?' on fight':''} boss" ${locked?'disabled':''} data-delve="${d.id}">
      <span><span>${d.n}</span><span class="meta">${locked?`Needs combat ${d.req} — you are ${cl}`
        :`${d.floors} floors &middot; <span class="${d.weak===st?'weak':'resist'}">weak to ${d.weak}</span> &middot; ${Math.round(d.ringC*100)}% ${item(d.ring).n}`}</span></span>
      <span class="rt">${fmt(d.bonusXp)} xp<br>${fmt(d.bonusGp)} gp</span></button>`;
  }
  h+=`<h2>Combat log</h2>`;
  h+=`<div class="log">${S.log.length?S.log.map(l=>{
    if(typeof l==='string')return `<div><span class="hit">${l}</span></div>`;
    return `<div><span class="tm">${l.s||''}</span><span class="${l.k}">${l.t}</span></div>`;
  }).join(''):'<div><span class="miss">Nothing yet.</span></div>'}</div>
  <div class="row" style="margin-top:8px"><div class="grow"><b>Combat log</b>
    <span>Last 80 events &middot; offline fighting is summarised, not logged</span></div>
    <button class="mini" data-clearlog="1">Clear</button></div>`;

  if(S.task){
    const f=FOES.find(x=>x.id===S.task.foe);
    h+=`<div class="task"><b>Slayer task</b> — ${S.task.done} / ${S.task.need} ${f.n}
      <div style="margin-top:6px"><button class="mini" data-skiptask="1">Skip task</button></div></div>`;
  }
  const food=Object.keys(S.bank).filter(k=>I[k]&&I[k].heal).reduce((n,k)=>n+S.bank[k],0);
  h+=`<h2>Choose a foe</h2>`;
  if(!food)h+=`<div class="empty">No cooked food banked. You will die eventually.</div>`;
  for(const f of FOES){
    const on=S.act==='fight:'+f.id;
    const isTask=S.task&&S.task.foe===f.id;
    h+=`<button class="act${on?' on fight':''}" data-go="fight:${f.id}">
      <span><span>${f.n}${isTask?' &middot; task':''}</span>
      <span class="meta">${f.hp} hp &middot; hits up to ${f.max} &middot; ${fmt(f.gp[0])}–${fmt(f.gp[1])} gp &middot; killed ${S.kills[f.id]||0}
      ${f.weak?`&middot; <span class="${f.weak===st?'weak':'resist'}">weak to ${f.weak}</span>`:''}
      ${[].concat(f.loot||[]).map(r=>`&middot; ${(r.c*100).toFixed(1)}% ${refLabel(r)}`).join('')}</span></span>
      <span class="rt">lv ${f.lvl}<br>${f.xp} xp</span></button>`;
  }
  return h;
}

function viewQuests(){
  let h=`<h2>Quests</h2>`;
  for(const q of QUESTS){
    const st=questState(q);
    const parts=[];
    if(q.need.lvl)for(const k in q.need.lvl)parts.push(`${label(k)} ${lvl(k)}/${q.need.lvl[k]}`);
    if(q.need.kills)for(const k in q.need.kills){const f=FOES.find(x=>x.id===k);
      parts.push(`${f.n} ${Math.min(S.kills[k]||0,q.need.kills[k])}/${q.need.kills[k]}`);}
    if(q.need.items)for(const k in q.need.items)parts.push(`${item(k).n} ${Math.min(have(k),q.need.items[k])}/${q.need.items[k]}`);
    const rw=[];
    if(q.reward.xp)for(const k in q.reward.xp)rw.push(`${fmt(q.reward.xp[k])} ${label(k).toLowerCase()} xp`);
    if(q.reward.items)for(const k in q.reward.items)rw.push(item(k).n);
    if(q.reward.gp)rw.push(`${fmt(q.reward.gp)} gp`);
    h+=`<div class="row ${st}"><div class="grow"><b>${q.n}</b>
      <span>${st==='done'?'Completed':q.blurb}<br>${st==='done'?'':parts.join(' &middot; ')}
      <br>Reward: ${rw.join(', ')}</span></div>
      ${st==='done'?'':`<button class="mini buy" data-quest="${q.id}" ${st==='ready'?'':'disabled'}>${st==='ready'?'Claim':'…'}</button>`}
    </div>`;
  }
  return h;
}

/* One quantity strip, shared by the bank, the exchange and the shop. `max` is
   whatever bounds the choice: stock held when selling, gold affordable when
   buying. Buttons rather than a number input, to match the rest of the app. */
function pickStrip(id,mode,unit,max,note){
  if(!(pick&&pick.id===id&&pick.mode===mode))return '';
  const label={sell:'Vendor',list:'List',order:'Buy',shop:'Buy'}[mode];
  const cancel=`<button class="mini" data-pickcancel="1">Cancel</button>`;
  if(max<1)return `<div class="row"><div class="grow"><b>${label} how many?</b>
    <span>${note}</span></div>${cancel}</div>`;
  const opts=[1,10,100,1000,10000].filter(q=>q<max);opts.push(max);
  const allLabel=(mode==='sell'||mode==='list')?`All ${fmt(max)}`:`Max ${fmt(max)}`;
  return `<div class="row"><div class="grow"><b>${label} how many?</b>
    <span>${fmt(unit)} gp each &middot; ${note}</span></div></div>
    <div class="row picks">${opts.map(q=>`<button class="mini buy" data-pickqty="${q}">${q===max?allLabel:fmt(q)}</button>`).join('')}
    ${cancel}</div>`;
}

/* Price panel for a live offer. Both directions, because the old control only
   undercut a sale or raised a bid — there was no way back if you overshot.
   Which direction fills faster depends on the kind, so the hint says so. */
function priceStrip(o,mkt){
  if(!(pick&&pick.mode==='price'&&pick.id===o.uid))return '';
  const left=o.qty-o.filled;
  const at=p=>Math.max(1,Math.round(o.price*(1+p/100)));
  const btn=p=>`<button class="mini${p>0?' buy':''}" data-price="${o.uid}:${at(p)}">${p>0?'+':''}${p}%</button>`;
  const faster=o.kind==='sell'?'lower fills faster':'higher fills faster';
  return `<div class="row"><div class="grow"><b>Adjust price</b>
    <span>now ${fmt(o.price)} gp &middot; market ${fmt(mkt)} gp &middot; ${fmt(left)} unfilled &middot; ${faster}${
      o.kind==='buy'?' &middot; raising costs gold now, lowering refunds':''}</span></div></div>
    <div class="row picks">${[-25,-10,10,25].map(btn).join('')}
    <button class="mini" data-price="${o.uid}:${mkt}">Match market</button>
    <button class="mini" data-pickcancel="1">Cancel</button></div>`;
}

function viewBank(){
  const used=bankUsed(),cap=bankCap(),pctc=(used/cap)*100;
  const capbar=`<div class="cap"><i class="${pctc>=100?'full':pctc>80?'warn':''}" style="width:${Math.min(100,pctc)}%"></i></div>`;
  const keys=Object.keys(S.bank).filter(k=>S.bank[k]>0);
  if(!keys.length)return `<h2>Bank &middot; ${used} / ${cap} slots</h2>${capbar}<div class="empty">Empty. Go chop something.</div>`;
  keys.sort((a,b)=>item(a).n.localeCompare(item(b).n));
  const worth=keys.reduce((n,k)=>n+item(k).v*S.bank[k],0);
  let h=`<h2>Bank &middot; ${used} / ${cap} slots &middot; worth ${fmt(worth)} gp</h2>${capbar}`;
  if(pctc>=100)h+=`<div class="empty" style="color:var(--blood)">Every slot is taken. Gathering has stopped and new item types are being lost.</div>`;
  const geFull=(S.offers||[]).length>=GE_SLOTS;
  for(const k of keys){
    const it=item(k),n=S.bank[k],eq=EQ[k];
    const worn=eq&&S.equip[eq.slot]===k;
    const tags=[`market ${fmt(marketPrice(k))} gp &middot; vendor ${fmt(Math.floor(it.v*0.7))} gp`];
    if(it.heal)tags.push(`heals ${it.heal}`);
    if(it.ammo)tags.push(`${it.ammo} · +${it.str} power`);
    if(eq){if(eq.str)tags.push(`+${eq.str} str`);if(eq.def)tags.push(`+${eq.def} def`);tags.push(eq.slot);}
    h+=`<div class="row"><div class="grow"><b>${it.n}</b><span>${tags.join(' · ')}</span></div>
      <span class="qty num">${fmt(n)}</span>
      ${eq?`<button class="mini eq" data-equip="${k}">${worn?'Worn':'Equip'}</button>`:''}
      <button class="mini${pick&&pick.id===k&&pick.mode==='list'?' on':''}" data-pick="list:${k}" ${geFull?'disabled':''}>List</button>
      <button class="mini${pick&&pick.id===k&&pick.mode==='sell'?' on':''}" data-pick="sell:${k}">Vendor</button></div>`;
    // Quantity strip. No number inputs anywhere else in this app, so it stays
    // buttons: the round numbers you actually own, then All.
    h+=pickStrip(k,'sell',Math.floor(it.v*0.7),n,`${fmt(n)} held`);
    h+=pickStrip(k,'list',marketPrice(k),n,`${fmt(n)} held`);
  }
  return h;
}

function escapeSave(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function petsHtml(){
  const keys=Object.keys(PETS);
  const got=keys.filter(k=>S.pets&&S.pets[k]).length;
  return `<h2>Pets &middot; ${got} of ${keys.length}</h2><div class="pets">${
    keys.map(k=>`<div class="pet${S.pets&&S.pets[k]?' got':''}">${S.pets&&S.pets[k]?PETS[k]:'???'}
      <br><span style="color:var(--dim)">${k==='combat'?'Combat':label(k)}</span></div>`).join('')
  }</div>`;
}
function viewShop(){
  let h=`<h2>Tools</h2>`;
  for(const t in TOOLS){
    const cur=S.tools[t],next=TOOLS[t][cur+1];
    const lbl=t==='axe'?'Woodcutting':t==='pick'?'Mining':'Fishing';
    h+=`<div class="row"><div class="grow"><b>${TOOLS[t][cur].n}</b>
      <span>${lbl} · ${next?`next: ${next.n}, ${Math.round((1-next.mul)*100)}% faster`:'fully upgraded'}</span></div>
      ${next?`<button class="mini buy" data-tool="${t}" ${S.gp<next.cost?'disabled':''}>${fmt(next.cost)} gp</button>`:''}</div>`;
  }
  h+=`<h2>Grand Exchange &middot; ${(S.offers||[]).length}/${GE_SLOTS} slots</h2>`;
  if(!(S.offers||[]).length)h+=`<div class="empty">No offers. List items from the Bank tab, or buy materials below.</div>`;
  for(let i=0;i<(S.offers||[]).length;i++){
    const o=S.offers[i],mkt=marketPrice(o.id),pct=(o.filled/o.qty)*100;
    const diff=Math.round(((o.price-mkt)/mkt)*100);
    h+=`<div class="offer ${o.kind}">
      <div class="top"><b>${o.kind==='sell'?'Selling':'Buying'} ${fmt(o.qty)}× ${item(o.id).n}</b>
        <span class="num">${fmt(o.price)} gp</span></div>
      <div class="sub">${fmt(o.filled)} of ${fmt(o.qty)} filled &middot; market ${fmt(mkt)} gp
        &middot; <span class="${(o.kind==='sell'?diff<=0:diff>=0)?'up':'down'}">${diff>0?'+':''}${diff}% vs market</span></div>
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <div class="acts">
        <button class="mini${pick&&pick.mode==='price'&&pick.id===o.uid?' on':''}" data-pick="price:${o.uid}">Price</button>
        <button class="mini" data-cancel="${i}">Cancel</button></div>${priceStrip(o,mkt)}</div>`;
  }
  h+=`<h2>Buy materials</h2>`;
  for(const id of BUYABLE){
    const mkt=marketPrice(id),base=item(id).v;
    const diff=Math.round(((mkt-base)/base)*100);
    h+=`<div class="row"><div class="grow"><b>${item(id).n}</b>
      <span>${fmt(mkt)} gp &middot; <span class="${diff<=0?'up':'down'}">${diff>0?'+':''}${diff}% vs base</span> &middot; you hold ${fmt(have(id))}</span></div>
      <button class="mini buy${pick&&pick.id===id&&pick.mode==='order'?' on':''}" data-pick="order:${id}" ${(S.gp<mkt||(S.offers||[]).length>=GE_SLOTS)?'disabled':''}>Buy</button></div>`;
    h+=pickStrip(id,'order',mkt,Math.floor(S.gp/mkt),`you can afford ${fmt(Math.floor(S.gp/mkt))}`);
  }
  h+=`<h2>Your house</h2>`;
  h+=`<div class="row"><div class="grow"><b>Passive bonuses</b>
    <span>Gold ×${goldMul().toFixed(2)} &middot; ${totalPatches()} patches &middot; ${bankCap()} bank slots
    &middot; crafting ${Math.round(room('workshop')*7)}% faster</span></div></div>`;
  for(const r of ROOMS){
    const t=room(r.id),nt=t+1;
    if(nt>3){h+=`<div class="row done"><div class="grow"><b>${r.n} III</b><span>${r.desc(3)} &middot; complete</span></div></div>`;continue;}
    const c=r.cost(nt);
    const parts=Object.keys(c).map(k=>k==='gp'?`${fmt(c.gp)} gp`:`${c[k]}× ${item(k).n}`);
    const afford=S.gp>=(c.gp||0)&&Object.keys(c).every(k=>k==='gp'||have(k)>=c[k]);
    h+=`<div class="row"><div class="grow"><b>${r.n}${t?' '+'I'.repeat(t):''} ${t?'→ ':''}${'I'.repeat(nt)}</b>
      <span>${r.desc(nt)}<br>${parts.join(', ')}</span></div>
      <button class="mini buy" data-room="${r.id}" ${afford?'':'disabled'}>Build</button></div>`;
  }
  h+=`<h2>Bank space</h2>`;
  const bt=S.bankTier||0,nextCap=BANK_TIERS[bt+1];
  h+=`<div class="row"><div class="grow"><b>${bankUsed()} / ${bankCap()} slots</b>
    <span>${nextCap?`Next: ${fmt(nextCap)} slots`:'Fully expanded'}</span></div>
    ${nextCap?`<button class="mini buy" data-bank="1" ${S.gp<BANK_COST[bt+1]?'disabled':''}>${fmt(BANK_COST[bt+1])} gp</button>`:''}</div>`;

  h+=`<h2>Farm patches</h2>`;
  const pcost=[0,0,0,8000,40000,180000][S.patches]||null;
  h+=`<div class="row"><div class="grow"><b>${totalPatches()} patches</b>
    <span>${S.patches<6?'Sow one more crop in parallel':'All six bought — the Garden adds more'}</span></div>
    ${S.patches<6?`<button class="mini buy" data-patch="1" ${S.gp<pcost?'disabled':''}>${fmt(pcost)} gp</button>`:''}</div>`;

  h+=`<h2>Seeds &amp; supplies</h2>`;
  for(const it of STOCK){
    const c=CROPS.find(x=>x.seed===it.id);
    const locked=c&&lvl('farming')<c.lvl;
    h+=`<div class="row"><div class="grow"><b>${item(it.id).n}</b>
      <span>${locked?`Farming ${c.lvl} required`:c?`Grows in ${Math.round(c.ms/60000)} min · ${c.harv} xp each`:'For mixing potions'} &middot; you have ${have(it.id)}</span></div>
      <button class="mini buy${pick&&pick.id===it.id&&pick.mode==='shop'?' on':''}" data-pick="shop:${it.id}" ${(S.gp<it.cost||locked)?'disabled':''}>${fmt(it.cost)} gp</button></div>`;
    if(!locked)h+=pickStrip(it.id,'shop',it.cost,Math.floor(S.gp/it.cost),`you can afford ${fmt(Math.floor(S.gp/it.cost))}`);
  }
  const totLvl=ALL_SKILLS.reduce((n,k)=>n+lvlFor(S.xp[k]||0),0);
  const totXp=ALL_SKILLS.reduce((n,k)=>n+(S.xp[k]||0),0);
  const kills=Object.values(S.kills||{}).reduce((a,b)=>a+b,0);
  const hrs=(S.played||0)/3600000;
  const petsGot=Object.keys(S.pets||{}).length;
  const questsDone=Object.keys(S.quests||{}).length;
  h+=`<h2>Progress</h2><div class="stats">
    <div><span class="n">Total level</span><span class="v num">${totLvl}</span></div>
    <div><span class="n">Total xp</span><span class="v num">${fmt(totXp)}</span></div>
    <div><span class="n">Time played</span><span class="v num">${hrs<1?Math.round(hrs*60)+'m':hrs.toFixed(1)+'h'}</span></div>
    <div><span class="n">Kills</span><span class="v num">${fmt(kills)}</span></div>
    <div><span class="n">Quests</span><span class="v num">${questsDone} / ${QUESTS.length}</span></div>
    <div><span class="n">Pets</span><span class="v num">${petsGot} / ${Object.keys(PETS).length}</span></div>
  </div>`;
  h+=petsHtml();
  if(Updater.supported){
    const st=Updater.state;
    const line=st==='checking'?'Checking…'
      :st==='ready'?`Version ${Updater.latest} is available`
      :st==='current'?'You are on the latest version'
      :st==='offline'?'Could not reach the server'
      :'Tap to check';
    h+=`<h2>App version</h2>`;
    h+=`<div class="row ${st==='ready'?'ready':''}"><div class="grow"><b>Hollowmere ${APP_VERSION}</b>
      <span>${line}</span></div>
      ${st==='ready'
        ? `<button class="mini buy" data-doupdate="1">Update</button>`
        : `<button class="mini" data-checkupdate="1" ${st==='checking'?'disabled':''}>Check</button>`}</div>`;
    if(st==='ready')h+=`<div class="empty">Your saves are not touched by updating.</div>`;
  }
  h+=`<h2>Save slots</h2>`;
  if(!Store.persistent)h+=`<div class="empty" style="color:var(--blood)">No storage available here — nothing will be kept when you close this. Export your save.</div>`;
  else h+=`<div class="empty">Saving to: ${Store.mode}</div>`;
  for(let i=1;i<=SLOTS_N;i++){
    const info=slotInfo[i-1],cur=i===curSlot;
    const when=info&&info.last?new Date(info.last).toLocaleDateString():'';
    h+=`<div class="row ${cur?'ready':''}"><div class="grow"><b>Slot ${i}${cur?' — active':''}</b>
      <span>${info?`total level ${info.lvl} &middot; ${fmt(info.gp)} gp &middot; ${(info.played/3600000).toFixed(1)}h &middot; ${when}`:'empty'}</span></div>
      ${cur?'':`<button class="mini eq" data-slot="${i}">${info?'Load':'New'}</button>`}
      ${info&&!cur?`<button class="mini" data-slotdel="${i}">Erase</button>`:''}</div>`;
  }
  h+=`<h2>Back up your save</h2>`;
  h+=`<div class="row"><div class="grow"><b>Your save lives in this browser only</b>
    <span>Clearing site data or switching phones loses it. Export a copy and keep it somewhere safe.</span></div></div>`;
  h+=`<textarea class="savebox" id="savetext" readonly onclick="this.select()">${escapeSave(JSON.stringify(S))}</textarea>`;
  h+=`<div class="row"><div class="grow"><b>Export</b><span>Copy the text above, or download a file</span></div>
    <button class="mini buy" data-copy="1">Copy</button>
    <button class="mini" data-download="1">File</button></div>`;
  h+=`<h2>Restore</h2>`;
  h+=`<textarea class="savebox" id="loadtext" placeholder="Paste a save here, then tap Restore"></textarea>`;
  h+=`<div class="row"><div class="grow"><b>Restore</b><span>Replaces everything currently in this browser</span></div>
    <button class="mini" data-restore="1">Restore</button></div>`;
  h+=`<h2>Notes</h2><div class="empty">Weapons, armour and amulets are made, not bought — train Smithing and Crafting.</div>`;
  return h;
}

function bodyHtml(){
  return tab==='train'?viewTrain():tab==='fight'?viewFight():tab==='quests'?viewQuests()
    :tab==='bank'?viewBank():viewShop();
}
let stashedRestoreText='';
function repaint(){
  const v=$('view'),y=v.scrollTop;
  /* The view is rebuilt wholesale with innerHTML, which destroys and
     recreates every element inside it. Doing that while someone is typing
     rips the field out from under them: focus is lost, the soft keyboard
     closes, and any paste menu vanishes. So hold off entirely while a text
     field is in use, and carry its contents across rebuilds either way. */
  const ae=document.activeElement;
  if(ae&&(ae.tagName==='TEXTAREA'||ae.tagName==='INPUT')){
    if(ae.id==='loadtext')stashedRestoreText=ae.value;
    return;
  }
  const before=document.getElementById('loadtext');
  if(before)stashedRestoreText=before.value;
  v.querySelectorAll('details.group').forEach(d=>{
    const k=d.querySelector('summary').textContent;
    if(d.open)openGroups.add(k);else openGroups.delete(k);
  });
  v.innerHTML=bodyHtml();
  v.querySelectorAll('details.group').forEach(d=>{
    if(openGroups.has(d.querySelector('summary').textContent))d.open=true;
  });
  v.scrollTop=y;
  const after=document.getElementById('loadtext');
  if(after&&stashedRestoreText)after.value=stashedRestoreText;
  $('purse').innerHTML=`${fmt(S.gp)} <span>gp</span>`;
  const qb=document.querySelector('nav button[data-tab="quests"]');
  qb.innerHTML='Quests'+(questsReady()?'<span class="pip"></span>':'');
}
function render(){
  renderDoing();repaint();
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
}

/* ============================================================
   INPUT
   ============================================================ */
document.querySelector('nav').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;tab=b.dataset.tab;pick=null;render();
});
$('view').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.go){
    const key=b.dataset.go;
    if(S.act===key){S.act=null;S.foe=null;}
    else{
      const bf=BOSSES.find(x=>'fight:'+x.id===key);
      if(bf){
        if(combatLvl()<bf.req){toast(`Needs combat ${bf.req}`);return;}
        if(have('boss_sigil')<1){toast('No boss sigil');return;}
        take('boss_sigil',1);S.foe=null;S.foeHp=0;
        pushLog(`Sigil spent — entering ${bf.n}`,'task');
      }
      if(S.delve&&key!==S.act)bankDelve('Left the dungeon');
      if(key.startsWith('fight')&&S.act!==key)resetSess();
      S.act=key;S.prog=0;S.stun=0;if(!key.startsWith('fight'))S.foe=null;
    }
    render();save();return;
  }
  if(b.dataset.pick){
    const i=b.dataset.pick.indexOf(':');
    const mode=b.dataset.pick.slice(0,i),id=b.dataset.pick.slice(i+1);
    if(mode==='list'&&(S.offers||[]).length>=GE_SLOTS){toast('No free offer slots');return;}
    pick=(pick&&pick.id===id&&pick.mode===mode)?null:{id,mode};
    render();return;
  }
  if(b.dataset.pickcancel){pick=null;render();return;}
  if(b.dataset.pickqty){
    if(!pick)return;
    const q=parseInt(b.dataset.pickqty,10)||0;
    if(q>0){
      if(pick.mode==='sell')vendor(pick.id,q);
      else if(pick.mode==='list')listOffer(pick.id,q);
      else if(pick.mode==='order')buyOffer(pick.id,q);
      else if(pick.mode==='shop')shopBuy(pick.id,q);
    }
    pick=null;render();save();return;
  }
  if(b.dataset.equip){
    const k=b.dataset.equip,eq=EQ[k];
    S.equip[eq.slot]=S.equip[eq.slot]===k?null:k;render();save();return;
  }
  if(b.dataset.tool){
    const t=b.dataset.tool,next=TOOLS[t][S.tools[t]+1];
    if(!next||S.gp<next.cost)return;
    S.gp-=next.cost;S.tools[t]++;toast(`Bought ${next.n}`);render();save();return;
  }
  if(b.dataset.quest){
    const q=QUESTS.find(x=>x.id===b.dataset.quest);if(q)claimQuest(q);
    render();save();return;
  }
  if(b.dataset.skiptask){rollTask();render();save();return;}
  if(b.dataset.checkupdate){Updater.check();return;}
  if(b.dataset.doupdate){Updater.apply();return;}
  if(b.dataset.slot){
    const i=+b.dataset.slot;
    loadSlot(i).then(()=>{lastFrame=Date.now();render();toast(`Slot ${i} active`);});
    return;
  }
  if(b.dataset.slotdel){
    const i=+b.dataset.slotdel;
    if(!confirm(`Erase slot ${i}? This cannot be undone.`))return;
    Store.del(slotKey(i)).then(refreshSlots).then(()=>{render();toast(`Slot ${i} erased`);});
    return;
  }
  if(b.dataset.copy){
    const t=JSON.stringify(S);
    const ta=document.getElementById('savetext');
    if(ta){ta.select();}
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(t).then(()=>toast('Save copied'),()=>toast('Copy blocked — select the text manually'));
    }else{
      try{document.execCommand('copy');toast('Save copied');}
      catch(e){toast('Copy blocked — select the text manually');}
    }
    return;
  }
  if(b.dataset.download){
    try{
      const blob=new Blob([JSON.stringify(S,null,1)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      const d=new Date();
      a.href=url;
      a.download=`hollowmere-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.json`;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),4000);
      toast('Save downloaded');
    }catch(e){toast('Download blocked — use Copy instead');}
    return;
  }
  if(b.dataset.restore){
    const ta=document.getElementById('loadtext');
    const raw=((ta&&ta.value)||stashedRestoreText||'').trim();
    if(!raw){toast('Paste a save first');return;}
    let p;
    try{p=JSON.parse(raw);}catch(e){toast('That is not valid save data');return;}
    if(!p||typeof p!=='object'||!p.xp||typeof p.xp!=='object'){toast('That save is missing its skills');return;}
    if(!confirm('Replace your current save? This cannot be undone.'))return;
    const f=fresh();
    S=Object.assign(f,p);
    S.xp=Object.assign(fresh().xp,p.xp||{});
    S.equip=Object.assign(fresh().equip,p.equip||{});
    S.house=Object.assign(fresh().house,p.house||{});
    S.farm=Array.isArray(p.farm)?p.farm:f.farm;
    S.offers=adoptOffers(p.offers);
    S.market=p.market||{};S.pets=p.pets||{};
    while(S.farm.length<totalPatches())S.farm.push({crop:null,ms:0});
    S.last=Date.now();
    stashedRestoreText='';
    render();save();toast('Save restored');
    return;
  }
  if(b.dataset.price){
    const i=b.dataset.price.lastIndexOf(':');
    const uid=b.dataset.price.slice(0,i),price=+b.dataset.price.slice(i+1);
    const o=(S.offers||[]).find(x=>x.uid===uid);
    if(!o){pick=null;render();return;}          // it filled and closed while the panel was open
    if(repriceOffer(o,price))pick=null;
    render();save();return;
  }
  if(b.dataset.cancel){
    const i=+b.dataset.cancel,o=S.offers[i];if(!o)return;
    const left=o.qty-o.filled;
    if(o.kind==='sell')add(o.id,left);else S.gp+=left*o.price;
    S.offers.splice(i,1);
    toast('Offer cancelled');render();save();return;
  }
  if(b.dataset.delve){
    const d=DUNGEONS.find(x=>x.id===b.dataset.delve);if(!d)return;
    if(combatLvl()<d.req){toast(`Needs combat ${d.req}`);return;}
    if(S.delve&&S.delve.id===d.id){
      const hg=bankDelve(`Left ${d.n}`);
      toast(hg?`Banked ${fmt(hg)} gp`:'Left the dungeon');
      S.act=null;S.foe=null;
    }
    else{S.delve={id:d.id,floor:0};S.act='delve:'+d.id;S.foe=null;S.foeHp=0;S.prog=0;
      resetSess();pushLog(`Entered ${d.n}`,'task');}
    render();save();return;
  }
  if(b.dataset.room){
    const r=ROOMS.find(x=>x.id===b.dataset.room);if(!r)return;
    const nt=room(r.id)+1;if(nt>3)return;
    const c=r.cost(nt);
    if(S.gp<(c.gp||0))return;
    for(const k in c)if(k!=='gp'&&have(k)<c[k])return;
    S.gp-=(c.gp||0);
    for(const k in c)if(k!=='gp')take(k,c[k]);
    S.house[r.id]=nt;
    if(r.id==='garden')while(S.farm.length<totalPatches())S.farm.push({crop:null,ms:0});
    toast(`${r.n} ${'I'.repeat(nt)} built`);render();save();return;
  }
  if(b.dataset.sow){
    const i=+b.dataset.sow,fl=lvl('farming');
    const sown=CROPS.filter(c=>fl>=c.lvl&&have(c.seed)>0);
    if(!sown.length)return;
    const c=sown[sown.length-1];
    take(c.seed,1);S.farm[i]={crop:c.id,ms:c.ms};grantXp('farming',c.plant);
    toast(`Sowed ${c.n}`);render();save();return;
  }
  if(b.dataset.harvest){
    const i=+b.dataset.harvest,pt=S.farm[i];
    if(!pt.crop||pt.ms>0)return;
    const c=CROPS.find(x=>x.id===pt.crop);
    const n=c.yield[0]+Math.floor(Math.random()*(c.yield[1]-c.yield[0]+1));
    const got=add(c.out,n);grantXp('farming',c.harv);
    rollPet('farming',c.ms/4);   // scaled to grow time so slow crops aren't punished
    S.farm[i]={crop:null,ms:0};
    toast(got?`Harvested ${got}× ${item(c.out).n}`:'Bank full — harvest lost');
    render();save();return;
  }
  if(b.dataset.bank){
    const t=(S.bankTier||0)+1;if(!BANK_TIERS[t]||S.gp<BANK_COST[t])return;
    S.gp-=BANK_COST[t];S.bankTier=t;toast(`Bank expanded to ${BANK_TIERS[t]} slots`);render();save();return;
  }
  if(b.dataset.patch){
    const cost=[0,0,0,8000,40000,180000][S.patches];
    if(S.patches>=6||S.gp<cost)return;
    S.gp-=cost;S.patches++;S.farm.push({crop:null,ms:0});
    toast(`${S.patches} patches`);render();save();return;
  }
  if(b.dataset.clearlog){S.log=[];resetSess();render();save();return;}
  if(b.dataset.wipe){if(confirm('Wipe your save? This cannot be undone.'))wipe();}
});

/* ============================================================
   LOOP
   ============================================================ */
let lastFrame=Date.now(),sinceSave=0,sinceFull=0;
function loop(){
  const now=Date.now(),dt=Math.min(now-lastFrame,2000);lastFrame=now;
  const before=S.act;
  tick(dt);
  renderDoing();
  sinceFull+=dt;
  if(sinceFull>800||before!==S.act){sinceFull=0;repaint();}
  sinceSave+=dt;if(sinceSave>10000){sinceSave=0;save();}
  requestAnimationFrame(loop);
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)save();
  else{const r=catchUp();lastFrame=Date.now();render();showCatchUp(r);}
});
(async function(){
  await Updater.register();
  await load();
  if(!S.task)rollTask();
  const r=catchUp();
  render();showCatchUp(r);
  lastFrame=Date.now();
  requestAnimationFrame(loop);
  // quiet check a few seconds in; only speaks up if there is something new
  if(Updater.supported)setTimeout(async()=>{
    await Updater.check();
    if(Updater.state==='ready')toast(`Version ${Updater.latest} available — Town tab`);
  },4000);
})();
