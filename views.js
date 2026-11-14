/* ============================================================
   RENDER
   ============================================================ */
let tab='train';
/* Open/closed state of every keyed <details> group, kept across rebuilds and
   tab switches, and the scroll position each tab was left at. UI state only. */
const groupOpen={},tabScroll={};
/* Which bank row has its quantity strip open, {id,mode}. Deliberately not on S
   — it is throwaway UI state and has no business in the save file. */
let pick=null;
const $=id=>document.getElementById(id);
const fmt=n=>n>=1e6?(n/1e6).toFixed(2)+'m':n>=1e4?Math.floor(n/1e3)+'k':String(Math.round(n));

/* Marks a button unavailable without the disabled attribute. A disabled
   button swallows the tap, so the player never learns why; this one still
   reaches the click handler, which shows the reason instead of acting. */
const off=(cond,why)=>cond?`aria-disabled="true" data-why="${String(why).replace(/"/g,'&quot;')}"`:'';
function dur2txt(sec){
  if(sec<60)return Math.ceil(sec)+'s';
  if(sec<3600)return Math.ceil(sec/60)+'m';
  const tm=Math.round(sec/60),h=Math.floor(tm/60),m=tm%60;
  return h>=100?h+'h':h+'h'+(m?' '+m+'m':'');
}
/* Toasts queue (9.x) instead of replacing each other, so a level-up and the
   loot that caused it are both read. A repeat of the message already waiting
   is dropped, and a long backlog keeps only the newest few. */
const toastQ=[];let toastOn=false;
function toast(msg){
  if(toastQ.includes(msg)||($('toast').textContent===msg&&toastOn))return;
  toastQ.push(msg);if(toastQ.length>4)toastQ.splice(0,toastQ.length-4);
  if(!toastOn)nextToast();
}
function nextToast(){
  const t=$('toast'),msg=toastQ.shift();
  if(msg===undefined){toastOn=false;t.classList.remove('show');return;}
  toastOn=true;t.textContent=msg;t.classList.add('show');
  clearTimeout(t._t);t._t=setTimeout(nextToast,toastQ.length?1500:1900);
}
/* A short buzz for level-ups and claims (9.x). The Android shell's haptic
   bridge when present, the Vibration API otherwise; Settings can turn it off. */
function buzz(kind){
  if(S&&S.buzz===false)return;
  try{
    if(window.HollowNative&&HollowNative.haptic){HollowNative.haptic(kind==='big'?'big':'tick');return;}
    if(navigator.vibrate&&(!navigator.userActivation||navigator.userActivation.hasBeenActive))navigator.vibrate(kind==='big'?[30,40,30]:18);
  }catch(e){}
}

function renderDoing(){
  const el=$('doing');
  if(S.stun>0){
    el.innerHTML=`<div class="doing-row"><b>Stunned</b><em>${(S.stun/1000).toFixed(1)}s</em></div>
      <div class="bar stun"><i style="width:100%"></i></div>`;return;
  }
  if(raid){
    const n=RAID.waves.length,w=Math.min(raid.wave,n-1),count=RAID.waves[w];
    const left=raid.lanes.reduce((a,l)=>a+l.q.length,0)+(count-raid.spawned);
    el.innerHTML=`<div class="doing-row"><b>${art('foes','raider')}Raid level ${raid.lvl} · wave ${w+1} of ${n}</b><em>${S.hp}/${maxHp()} hp</em></div>
      <div class="bar fight"><i style="width:${(left/count)*100}%"></i></div>`;return;
  }
  const cur=findAct(S.act);
  if(!cur){el.innerHTML='<div class="idlemsg">Idle — pick something to train.</div>';return;}
  if(cur.skill==='delve'){
    const f=cur.foe,pct=Math.max(0,(S.foeHp/f.hp)*100);
    el.innerHTML=`<div class="doing-row"><b>${art('foes',String(f.id).split('#')[0])}${f.n}</b><em>${S.hp}/${maxHp()} hp</em></div>
      <div class="bar fight"><i style="width:${pct}%"></i></div>`;return;
  }
  if(cur.skill==='fight'){
    const f=cur.foe,pct=Math.max(0,(S.foeHp/f.hp)*100);
    el.innerHTML=`<div class="doing-row"><b>${art('foes',f.id)}Fighting ${f.n}</b><em>${S.hp}/${maxHp()} hp</em></div>
      <div class="bar fight"><i style="width:${pct}%"></i></div>`;return;
  }
  const{skill,a}=cur,dur=actDur(skill,a),rate=a.xp/(dur/1000);
  const xp=S.xp[skill]||0,L=lvlFor(xp);
  const next=L<99&&rate>0?` &middot; ${L+1} in ${dur2txt((XP[L]-xp)/rate)}`:'';
  el.innerHTML=`<div class="doing-row"><b>${label(skill)} &middot; ${a.n}</b>
    <em style="white-space:nowrap">${fmt(rate*3600)} xp/hr${next}</em></div>
    <div class="bar"><i style="width:${Math.min(100,(S.prog/dur)*100)}%"></i></div>`;
}

/* Each tile is a button: a trainable skill opens its list below, Farming
   jumps to the patches, and the combat skills go to the Fight tab. */
function skillStrip(){
  const cur=S.act?S.act.split(':')[0]:null;
  return `<div class="skills">${ALL_SKILLS.map(k=>{
    const xp=S.xp[k]||0,l=lvlFor(xp),p=xpInto(xp);
    return `<button class="sk${l>=99?' max':''}${k===cur?' on':''}" data-skill="${k}"><span class="n">${label(k)}</span>
      <span class="v num">${art('skills',k)}${l}${l<99?`<small>${fmt(XP[l]-xp)}</small>`:''}</span><div class="xpbar"><i style="width:${p.pct}%"></i></div></button>`;
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
  return `<button class="act${on?' on':''}" ${off(!ok,`Needs ${label(key)} ${a.lvl}`)} data-go="${key}:${a.id}">
    <span><span>${a.n}</span><span class="meta">${ok?(bits.join(' · ')||'—'):'Requires level '+a.lvl}</span></span>
    <span class="rt">${fmt(a.xp)} xp<br>${(dur/1000).toFixed(1)}s</span></button>`;
}

/* Next goals (9.0): the three nearest milestones. Tap one to go to it; the
   pin keeps it first and announces it when reached. */
function goalsHtml(){
  const gs=nextGoals(3);if(!gs.length)return '';
  return `<h2>Next goals</h2>`+gs.map(g=>`<div class="row goal${g.pinned?' ready':''}">
    <button class="grow glink" data-goal="${g.key}"><b>${g.title}</b><span>${g.sub}</span>
      <div class="pbar"><i style="width:${Math.round(Math.min(1,g.p)*100)}%"></i></div></button>
    <button class="mini${g.pinned?' on':''}" data-pin="${g.key}">${g.pinned?'Pinned':'Pin'}</button></div>`).join('');
}
function fairHtml(){
  const sk=fairSkill();
  return `<div class="row fair"><div class="grow"><b>Fair week: ${label(sk)} +${Math.round(FAIR.bonus*100)}% xp</b>
    <span>A different skill each week. Ends in ${dur2txt(fairEnds()/1000)}.</span></div></div>`;
}
function viewTrain(){
  let h=fairHtml()+goalsHtml()+`<h2>Levels &middot; combat ${combatLvl()}</h2>${skillStrip()}`;

  h+=`<h2 id="farm">Farm &middot; ${totalPatches()} patches</h2>`;
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
        <button class="mini ${ready?'buy':''}" data-harvest="${i}" ${off(!ready,`Ready in ${mins} min`)}>${ready?'Harvest':'Growing'}</button></div>`;
    }
  });
  h+=`<h2>Train a skill</h2>`;
  for(const key in SKILLS){
    const s=SKILLS[key],L=lvl(key);
    const open=(S.act&&S.act.startsWith(key+':'))?' open':'';
    h+=`<details class="group" id="grp-${key}" data-key="train-${key}"${open}><summary>${art('skills',key)}${s.n}<span class="lv num">lv ${L}</span></summary>`;
    for(const a of s.acts){
      if(a.sub){h+=`<div class="subhead">${a.sub}</div>`;continue;}
      h+=actRow(key,a,L>=a.lvl,S.act===key+':'+a.id);
    }
    h+=`</details>`;
  }
  return h;
}

/* Fight sections; null means follow the current activity. UI state only. */
const FIGHT_SECS=[['foes','Foes'],['bosses','Bosses'],['dungeons','Dungeons']];
let fightSec=null;
function viewFight(){
  const G=gear(),P=prayerBonus();
  const st=style(),ammo=bestAmmo(st);
  const maxHit=maxHitFor(st,G,P,ammo);
  let h=`<div class="arena">
    <div class="hpline"><span>Your health</span><span class="num">${S.hp} / ${maxHp()}</span></div>
    <div class="hpbar"><i style="width:${(S.hp/maxHp())*100}%"></i></div>
    <div class="hpline"><span>${st} &middot; max hit ${maxHit}</span><span class="num">+${G.def} defence${G.acc[st]?` &middot; +${G.acc[st]}% acc`:''}</span></div></div>`;
  // Tapping a style wields the best weapon you own for it.
  const sty=(k,n,v)=>`<button class="${st===k?'cur':''}" ${off(st!==k&&k!=='melee'&&!bestWeapon(k),`No ${k==='ranged'?'bow':'staff'} in the bank`)} data-style="${k}"><span class="n">${n}</span><span class="v num">${v}</span></button>`;
  h+=`<div class="styles">${sty('melee','Melee',lvl('attack')+'/'+lvl('strength'))}${sty('ranged','Ranged',lvl('ranged'))}${sty('magic','Magic',lvl('magic'))}</div>`;
  if(ammoKind(st))h+=`<div class="buffs">${ammo?`Firing ${item(ammo).n} — ${fmt(have(ammo))} left${ammoKind(st)==='arrow'?' &middot; 1 in 3 recovered':''}`:`<span class="resist">No ${ammoKind(st)}s banked — you are swinging bare-handed</span>`}</div>`;
  const bk=Object.keys(S.buffs||{});
  if(bk.length)h+=`<div class="buffs">Active: ${bk.map(k=>`+${S.buffs[k].amt} ${k} (${Math.ceil(S.buffs[k].ms/60000)}m)`).join(' &middot; ')}</div>`;

  if(S.task)h+=`<h2>Slayer</h2>`;
  if(S.task){
    const f=FOES.find(x=>x.id===S.task.foe);
    h+=`<div class="task"><b>Slayer task</b> — ${S.task.done} / ${S.task.need} ${f.n}
      <div style="margin-top:6px"><button class="mini" data-skiptask="1">Skip task</button></div></div>`;
  }
  // Foes, bosses and dungeons share one place on screen. Until the player
  // picks, it follows what they are doing.
  const sec=fightSec||(S.act&&S.act.startsWith('delve:')?'dungeons'
    :BOSSES.some(f=>S.act==='fight:'+f.id)?'bosses':'foes');
  h+=`<div class="seg">${FIGHT_SECS.map(([k,n])=>`<button class="mini${sec===k?' on':''}" data-fsec="${k}">${n}</button>`).join('')}</div>`;
  if(sec==='foes'){
  const food=Object.keys(S.bank).filter(k=>I[k]&&I[k].heal).reduce((n,k)=>n+S.bank[k],0);
  if(!food)h+=`<div class="empty">No cooked food banked. You will die eventually.</div>`;
  for(const f of FOES){
    const on=S.act==='fight:'+f.id;
    const isTask=S.task&&S.task.foe===f.id;
    h+=`<button class="act${on?' on fight':''}" data-go="fight:${f.id}">${art('foes',f.id)}
      <span><span>${f.n}${isTask?' &middot; task':''}</span>
      <span class="meta">${f.hp} hp &middot; hits up to ${f.max} &middot; ${fmt(f.gp[0])}–${fmt(f.gp[1])} gp &middot; killed ${S.kills[f.id]||0}
      ${f.weak?`&middot; <span class="${f.weak===st?'weak':'resist'}">weak to ${f.weak}</span>`:''}
      ${[].concat(f.loot||[]).map(r=>`&middot; ${(r.c*100).toFixed(1)}% ${refLabel(r)}`).join('')}</span></span>
      <span class="rt">lv ${f.lvl}<br>${f.xp} xp</span></button>`;
  }
  }else if(sec==='bosses'){
  h+=`<div class="row"><div class="grow"><b>${have('boss_sigil')} boss sigils</b>
    <span>One is spent per attempt. Slayer tasks drop them about a third of the time.</span></div></div>`;
  for(const f of BOSSES){
    const cl=combatLvl(),locked=cl<f.req,noKey=have('boss_sigil')<1;
    const on=S.act==='fight:'+f.id;
    h+=`<button class="act${on?' on fight':''} boss" ${off(locked||(noKey&&!on),locked?`Needs combat ${f.req}`:'No boss sigils. Slayer tasks drop them.')} data-go="fight:${f.id}">${art('foes',f.id)}
      <span><span>${f.n}</span><span class="meta">${locked?`Needs combat ${f.req} — you are ${cl}`
        :`${f.hp} hp &middot; hits up to ${f.max} &middot; ${[].concat(f.unique||[]).map(u=>`${Math.round(u.c*100)}% ${refLabel(u)}`).join(' &middot; ')} &middot; slain ${S.bossKills[f.id]||0}
        &middot; <span class="${f.weak===st?'weak':'resist'}">weak to ${f.weak}</span>`}</span></span>
      <span class="rt">lv ${f.lvl}<br>${fmt(f.xp)} xp</span></button>`;
  }
  }else{
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
    h+=`<button class="act${on?' on fight':''} boss" ${off(locked,`Needs combat ${d.req}`)} data-delve="${d.id}">${art('foes',d.id)}
      <span><span>${d.n}</span><span class="meta">${locked?`Needs combat ${d.req} — you are ${cl}`
        :`${d.floors} floors &middot; <span class="${d.weak===st?'weak':'resist'}">weak to ${d.weak}</span> &middot; ${Math.round(d.ringC*100)}% ${item(d.ring).n}`}</span></span>
      <span class="rt">${fmt(d.bonusXp)} xp<br>${fmt(d.bonusGp)} gp</span></button>`;
  }
  }
  h+=`<h2>Session</h2>`;
  const ss=S.sess||{},acc=ss.swings?Math.round((ss.hits/ss.swings)*100):0;
  h+=`<details class="group fold" data-key="fight-sess"><summary>This session<span class="lv num">${fmt(ss.kills||0)} kills &middot; ${fmt(ss.gp||0)} gp</span></summary><div class="sess">
    <div><span class="n">Kills</span><span class="v">${fmt(ss.kills||0)}</span></div>
    <div><span class="n">Gold</span><span class="v">${fmt(ss.gp||0)}</span></div>
    <div><span class="n">Accuracy</span><span class="v">${acc}%</span></div>
    <div><span class="n">Damage out</span><span class="v">${fmt(ss.dealt||0)}</span></div>
    <div><span class="n">Damage in</span><span class="v">${fmt(ss.taken||0)}</span></div>
    <div><span class="n">Food eaten</span><span class="v">${fmt(ss.eaten||0)}</span></div>
  </div></details>`;
  h+=`<details class="group fold" data-key="fight-log"><summary>Combat log<span class="lv num">${S.log.length} events</span></summary>`;
  h+=`<div class="log" data-keep="fight-log">${S.log.length?S.log.map(l=>{
    if(typeof l==='string')return `<div><span class="hit">${l}</span></div>`;
    return `<div><span class="tm">${l.s||''}</span><span class="${l.k}">${l.t}</span></div>`;
  }).join(''):'<div><span class="miss">Nothing yet.</span></div>'}</div>
  <div class="row" style="margin-top:8px"><div class="grow"><b>Combat log</b>
    <span>Last 80 events &middot; offline fighting is summarised, not logged</span></div>
    <button class="mini" data-clearlog="1">Clear</button></div></details>`;
  return h;
}

/* The Quests tab holds the errand board (9.2) and the quests. UI state only. */
const QUEST_SECS=[['errands','Errands'],['trails','Trails'],['quests','Quests']];
let questSec='errands';
function viewQuestsTab(){
  const r=errandsReady();
  const tr=TRAILS.filter(t=>S.trails[t.id]&&(S.trails[t.id].casket||S.trails[t.id].sealed)).length;
  let h=`<div class="seg town">${QUEST_SECS.map(([k,n])=>`<button class="mini${questSec===k?' on':''}" data-qsec="${k}">${n}${k==='errands'&&r?` <small>${r}</small>`:''}${k==='trails'&&tr?` <small>${tr}</small>`:''}</button>`).join('')}</div>`;
  return h+(questSec==='errands'?viewErrands():questSec==='trails'?viewTrails():viewQuests());
}
function viewTrails(){
  let h=`<h2>Treasure trails</h2>`;
  if(lastCasket){const c=lastCasket;
    h+=`<div class="row${c.rare?' ready':' done'}"><div class="grow"><b>${c.tier} casket${c.rare?' — '+item(c.rare).n+'!':''}</b>
      <span>${fmt(c.gp)} gp &middot; ${c.marks} marks${c.got.length?' &middot; '+c.got.join(', '):''}</span></div></div>`;}
  for(const t of TRAILS){
    const T=S.trails[t.id],done=(S.trailsDone||{})[t.id]||0;
    const head=`${t.n} trail${done?` <span class="dim">&middot; ${done} done</span>`:''}`;
    if(!T){h+=`<div class="row"><div class="grow"><b>${head}</b><span>None held. ${t.lvl?`Drops from level ${t.lvl}+ activities.`:'Drops from any activity.'} ${t.steps} steps, then a casket.</span></div></div>`;continue;}
    if(T.sealed){h+=`<div class="row ready"><div class="grow"><b>${head}</b><span>Sealed. Open it to read the first step — ${t.steps} in all.</span></div>
      <button class="mini buy" data-trail="${t.id}">Open</button></div>`;continue;}
    if(T.casket){h+=`<div class="row ready"><div class="grow"><b>${head}</b><span>Trail complete. The casket is yours.</span></div>
      <button class="mini buy" data-casket="${t.id}">Open casket</button></div>`;continue;}
    const e=T.steps[T.i],left=errandLeft(e),dn=e.n-left;
    h+=`<div class="row"><div class="grow"><b>${head} &middot; step ${T.i+1} of ${T.steps.length}</b>
      <span>${errandText(e)} &middot; ${fmt(dn)} / ${fmt(e.n)}</span>
      <div class="pbar"><i style="width:${Math.min(100,dn/e.n*100)}%"></i></div></div></div>`;
  }
  h+=`<div class="empty">One trail of each tier can be held at a time. Steps move on by themselves as you play, offline too. Caskets pay gold, marks and materials, and now and then something for the collection log.</div>`;
  return h;
}
function viewErrands(){
  const E=S.errands,W=S.well;
  let h=`<h2>Errand board &middot; ${fmt(S.marks||0)} marks</h2>`;
  if(!E.board.length)h+=`<div class="empty">No errands posted. A new one arrives every 8 hours.</div>`;
  for(const e of E.board){
    const left=errandLeft(e),done=e.n-left;
    h+=`<div class="row${left<=0?' ready':''}"><div class="grow"><b>${errandText(e)}</b>
      <span>${left<=0?'Done — hand it in':`${fmt(done)} / ${fmt(e.n)}`} &middot; ${ERRAND.marks} marks and gold</span>
      <div class="pbar"><i style="width:${Math.min(100,done/e.n*100)}%"></i></div></div>
      ${left<=0?`<button class="mini buy" data-errand="${e.uid}">Hand in</button>`:`<button class="mini" data-swap="${e.uid}">Swap</button>`}</div>`;
  }
  const next=Math.max(0,E.at+86400000/ERRAND.perDay-Date.now());
  h+=`<div class="empty">${E.stock?`${E.stock} more waiting. `:''}${E.board.length+E.stock<ERRAND.cap?`Next errand in ${dur2txt(next/1000)}. `:'The board is full. '}Errands bank up to a week, so a missed day loses nothing. Swapping is free.</div>`;
  const sk=lowestSkill(),wn=sk?wellAmount(sk):0;
  h+=`<h2>The Wellspring</h2><div class="row${W.charges?' ready':''}"><div class="grow"><b>${W.charges} of ${WELL.cap} charges</b>
    <span>${sk?`Pours ${fmt(wn)} xp into your lowest skill, ${label(sk)}.`:'Every skill is 99.'} A charge gathers every week; it holds four.</span></div>
    <button class="mini buy" data-well="1" ${off(!W.charges||!sk,'No charge yet — one gathers every week')}>Draw</button></div>`;
  h+=`<h2>Guild shop</h2>`;
  for(const g of GUILD.filter(g=>g.id!=='trail'||typeof giveTrail==='function')){
    const bought=(S.guild||{})[g.id]||0,maxed=g.max&&bought>=g.max;
    h+=`<div class="row"><div class="grow"><b>${g.n}</b><span>${g.desc}${maxed?' &middot; bought':''}</span></div>
      <button class="mini buy${pick&&pick.mode==='tome'&&g.id==='tome'?' on':''}" data-guild="${g.id}" ${off(maxed||(S.marks||0)<g.cost,maxed?'Already bought':`Needs ${g.cost-(S.marks||0)} more marks`)}>${g.cost} marks</button></div>`;
    if(g.id==='tome'&&pick&&pick.mode==='tome'){
      h+=`<div class="row picks">${ALL_SKILLS.filter(k=>lvl(k)<99).map(k=>`<button class="mini" data-tome="${k}">${label(k)}</button>`).join('')}<button class="mini" data-pickcancel="1">Cancel</button></div>`;
    }
  }
  return h;
}
const QUEST_BANDS=[['novice','Novice'],['adept','Adept'],['veteran','Veteran'],['master','Master']];
function questRow(q){
  const st=questState(q);
  const parts=reqParts(q.need,S);
  const rw=[];
  if(q.reward.xp)for(const k in q.reward.xp)rw.push(`${fmt(q.reward.xp[k])} ${label(k).toLowerCase()} xp`);
  if(q.reward.items)for(const k in q.reward.items){const n=q.reward.items[k];rw.push(`${n>1?fmt(n)+'× ':''}${item(k).n}`);}
  if(q.reward.gp)rw.push(`${fmt(q.reward.gp)} gp`);
  return `<div class="row ${st}"><div class="grow"><b>${q.n}</b>
      <span>${st==='done'?'Completed':q.blurb}<br>${st==='done'?'':parts.join(' &middot; ')}
      <br>Reward: ${rw.join(', ')}</span></div>
      ${st==='done'?'':`<button class="mini buy" data-quest="${q.id}" ${off(st!=='ready','Not every requirement is met yet')}>${st==='ready'?'Claim':'…'}</button>`}
    </div>`;
}
function viewQuests(){
  const done=QUESTS.filter(q=>S.quests[q.id]).length;
  let h=`<h2>Quests &middot; ${done} / ${QUESTS.length}</h2>`;
  if(S.capes.quests)h+=`<div class="row done"><div class="grow"><b>Wayfarer's cloak</b><span>Every quest complete</span></div></div>`;
  else if(done===QUESTS.length)h+=`<div class="row ready"><div class="grow"><b>Wayfarer's cloak</b><span>Every quest complete — free a bank slot to take it</span></div><button class="mini buy" data-cloak="1">Claim</button></div>`;
  else h+=`<div class="empty">Finish every quest to earn the Wayfarer's cloak.</div>`;
  // A band opens by default if it has a quest ready, or if it is the lowest one
  // with work left. After that the player's own open/closed choice sticks, via
  // the data-key that repaint() uses to carry state across rebuilds.
  let firstOpen=false;
  for(const [b,nm] of QUEST_BANDS){
    const qs=QUESTS.filter(q=>q.band===b);if(!qs.length)continue;
    const d=qs.filter(q=>S.quests[q.id]).length,r=qs.filter(q=>questState(q)==='ready').length;
    let open=r>0;if(!firstOpen&&d<qs.length){open=true;firstOpen=true;}
    h+=`<details class="group" data-key="quests-${b}"${open?' open':''}><summary>${nm}<span class="lv num">${d}/${qs.length}${r?` &middot; ${r} ready`:''}</span></summary>`;
    for(const q of qs)h+=questRow(q);
    h+=`</details>`;
  }
  return h;
}

/* Diary task lines reuse the quest wording, minus what does not fit here: a
   met task gets one tick for the whole line, and a quest reads "Finish X"
   rather than the chain-lock "After X". */
function diaryTaskText(task,met){
  const t=reqParts(task,S).map(p=>p.replace(/^✓ /,'').replace(/^After /,'Finish ')).join(' &middot; ');
  return met?'✓ '+t:t;
}
function diaryTierRow(d,i){
  const t=d.tiers[i],st=tierState(d,i);
  const met=t.tasks.map(x=>meets(x,S));
  const n=met.filter(Boolean).length;
  return `<div class="row ${st}"><div class="grow"><b>${DIARY_TIERS[i]} &middot; ${st==='done'?'Complete':n+'/'+t.tasks.length}</b>
      <span>Perk: ${t.desc}${st==='done'?'':'<br>'+t.tasks.map((x,j)=>diaryTaskText(x,met[j])).join('<br>')}</span></div>
      ${st==='done'?'':`<button class="mini buy" data-tier="${d.id}:${i}" ${off(st!=='ready','Not every task is done yet')}>${st==='ready'?'Claim':'…'}</button>`}
    </div>`;
}
/* The Diary tab holds the diary and, from 9.1, the collection log. UI state only. */
const DIARY_SECS=[['diary','Diary'],['log','Collection log']];
let diarySec='diary';
function viewDiaryTab(){
  const nw=(S.clogNew||[]).length;
  let h=`<div class="seg town">${DIARY_SECS.map(([k,n])=>`<button class="mini${diarySec===k?' on':''}" data-dsec="${k}">${n}${k==='log'&&nw?` <small>${nw} new</small>`:''}</button>`).join('')}</div>`;
  return h+(diarySec==='log'?viewLog():viewDiary());
}
function viewLog(){
  const{n,of}=clogCount(),rk=S.clogRank||0;
  const next=CLOG_RANKS[rk];
  const fresh=new Set(S.clogNew||[]);
  let h=`<h2>Collection log &middot; ${n} / ${of}</h2>`;
  h+=`<div class="row${rk?' done':''}"><div class="grow"><b>${rk?CLOG_RANKS[rk-1].n+' collector':'No rank yet'}</b>
    <span>${next?`${n} of ${Math.ceil(next.at*of)} slots for ${next.n}`:'Every slot filled'} &middot; each rank adds an hour to offline progress (+${rk}h now)</span>
    <div class="pbar"><i style="width:${Math.min(100,n/of*100)}%"></i></div></div></div>`;
  h+=`<div class="empty">A slot fills the first time you earn it. Buying never counts.</div>`;
  for(const g of CLOG){
    const sl=g.slots(),got=sl.filter(x=>clogHas(x.id)).length,nw=sl.filter(x=>fresh.has(x.id)).length;
    h+=`<details class="group" data-key="log-${g.id}"${nw?' open':''}><summary>${g.n}<span class="lv num">${got}/${sl.length}${nw?` &middot; ${nw} new`:''}</span></summary>`;
    for(const x of sl){
      const has=clogHas(x.id),pet=x.id.startsWith('pet:');
      const nm=pet?PETS[x.id.slice(4)]:item(x.id).n;
      const cnt=pet?'':(S.clog[x.id]?fmt(S.clog[x.id]):'');
      h+=`<div class="lrow${has?'':' miss'}${fresh.has(x.id)?' new':''}">${has&&!pet?art('items',x.id):has&&pet?art('pets',x.id.slice(4)):''}<span class="grow">${has?nm:'???'}<small>${x.src}</small></span><span class="num">${fresh.has(x.id)?'new':cnt}</span></div>`;
    }
    h+=`</details>`;
  }
  return h;
}
function viewDiary(){
  const all=DIARY.reduce((n,d)=>n+d.tiers.length,0);
  const done=Object.keys(S.diary||{}).length;
  let h=`<h2>Achievement diary &middot; ${done} / ${all}</h2>`;
  if(S.capes.diary)h+=`<div class="row done"><div class="grow"><b>Diarist's cape</b><span>Every diary complete</span></div></div>`;
  else if(done===all)h+=`<div class="row ready"><div class="grow"><b>Diarist's cape</b><span>Every diary complete — free a bank slot to take it</span></div><button class="mini buy" data-dcape="1">Claim</button></div>`;
  else h+=`<div class="empty">Tiers can be finished in any order. Complete all ${all} to earn the Diarist's cape.</div>`;
  // Same opening rule as the quest bands: a diary with a tier ready opens, and
  // so does the first with work left; after that the player's choice sticks.
  let firstOpen=false;
  for(const d of DIARY){
    const sts=d.tiers.map((t,i)=>tierState(d,i));
    const dn=sts.filter(x=>x==='done').length,r=sts.filter(x=>x==='ready').length;
    let open=r>0;if(!firstOpen&&dn<d.tiers.length){open=true;firstOpen=true;}
    h+=`<details class="group" data-key="diary-${d.id}"${open?' open':''}><summary>${d.n}<span class="lv num">${dn}/${d.tiers.length}${r?` &middot; ${r} ready`:''}</span></summary>`;
    for(let i=0;i<d.tiers.length;i++)h+=diaryTierRow(d,i);
    h+=`</details>`;
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

/* Item art (7.9). Pure decoration: with Art off, or an image not made yet,
   art() returns nothing or the image removes itself, and the screen is the
   text it always was. Bump ART_V when images are redrawn: the service
   worker serves them cache-first, so a new URL is the only way to refresh. */
const ART_V=7;   // 2: 8.0 redrew icons whose parts floated; 3: 8.4 closed small gaps; 4: 8.6 new gear icons and redrawn capes; 5: 8.7 castle rooms; 6: 8.8 raid art and backdrops; 7: 9.7 pets, tool tiers and trail rewards
const ART_STYLES=[['off','Off'],['lp','Low poly'],['hd','HD poly']];
/* Art that failed to load is remembered, so a tab that re-renders every tick
   does not keep re-adding an image that will never arrive (it flickered). */
const ART_MISSING=new Set();
function artMiss(img){ART_MISSING.add(img.dataset.k);img.remove();}
function art(area,id){
  const st=S.art;
  if(st!=='lp'&&st!=='hd')return '';
  const k=`${st}/${area}/${id}`;
  if(ART_MISSING.has(k))return '';
  return `<img class="art" src="./art/${k}.webp?v=${ART_V}" data-k="${k}" alt="" loading="lazy" decoding="async" onerror="artMiss(this)">`;
}

/* What is worn, with the totals it adds up to. Lives on the Bank's Gear
   filter, next to the items it is equipped from. */
function equipHtml(){
  let h=`<div class="slots">`;
  for(const sl of SLOTS){
    const id=S.equip[sl];
    h+=`<div class="slot${id?'':' none'}"><span class="n">${cap0(sl)}</span>
      <span class="v">${id?art('items',id)+EQ[id].n:'empty'}</span></div>`;
  }
  const G=gear(),P=prayerBonus();
  const ac=Object.keys(G.acc).map(k=>` &middot; +${G.acc[k]}% ${k} accuracy`).join('');
  h+=`</div><div class="row"><div class="grow"><b>+${G.str} strength &middot; +${G.def} defence${ac}</b>
    <span>Prayer adds +${P.hit} max hit and soaks ${P.soak} damage</span></div></div>`;
  return h;
}

/* Bank view state: filter, sort, and which row has its actions open. UI only. */
const BANK_FILTERS=[['all','All'],['gear','Gear'],['supplies','Supplies'],['ammo','Ammo'],['mats','Materials']];
const BANK_SORTS=[['name','Name'],['qty','Amount'],['value','Value']];
let bankFilter='all',bankSort='name',bankOpen=null;
function bankKind(k){
  const it=item(k);
  if(EQ[k])return 'gear';
  if(it.ammo)return 'ammo';
  if(it.heal||it.buff)return 'supplies';
  return 'mats';
}
function viewBank(){
  const used=bankUsed(),cap=bankCap(),pctc=(used/cap)*100;
  const capbar=`<div class="cap"><i class="${pctc>=100?'full':pctc>80?'warn':''}" style="width:${Math.min(100,pctc)}%"></i></div>`;
  const all=Object.keys(S.bank).filter(k=>S.bank[k]>0);
  const worth=all.reduce((n,k)=>n+item(k).v*S.bank[k],0);
  let h=`<h2>Bank &middot; ${used} / ${cap} slots${all.length?` &middot; worth ${fmt(worth)} gp`:''}</h2>${capbar}`;
  if(pctc>=100)h+=`<div class="empty" style="color:var(--blood)">Every slot is taken. Gathering has stopped and new item types are being lost.</div>`;
  const count=f=>f==='all'?all.length:all.filter(k=>bankKind(k)===f).length;
  h+=`<div class="seg chips">${BANK_FILTERS.map(([f,n])=>`<button class="mini${bankFilter===f?' on':''}" data-bfilter="${f}">${n} <small>${count(f)}</small></button>`).join('')}</div>`;
  h+=`<div class="seg sorts"><span>Sort</span>${BANK_SORTS.map(([f,n])=>`<button class="mini${bankSort===f?' on':''}" data-bsort="${f}">${n}</button>`).join('')}</div>`;
  if(bankFilter==='gear')h+=equipHtml();
  const keys=bankFilter==='all'?all:all.filter(k=>bankKind(k)===bankFilter);
  if(!keys.length)return h+`<div class="empty">${all.length?'Nothing of this kind banked.':'Empty. Go chop something.'}</div>`;
  const byName=(a,b)=>item(a).n.localeCompare(item(b).n);
  keys.sort(bankSort==='qty'?(a,b)=>S.bank[b]-S.bank[a]||byName(a,b)
    :bankSort==='value'?(a,b)=>item(b).v*S.bank[b]-item(a).v*S.bank[a]||byName(a,b):byName);
  const geFull=(S.offers||[]).length>=geSlots();
  for(const k of keys){
    const it=item(k),n=S.bank[k],eq=EQ[k];
    const worn=eq&&S.equip[eq.slot]===k,open=bankOpen===k;
    h+=`<button class="brow${open?' open':''}" data-brow="${k}"><span class="nm">${art('items',k)}${it.n}${worn?' <em>worn</em>':''}</span>
      <span class="qty num">${fmt(n)}</span></button>`;
    if(!open)continue;
    const tags=[`market ${fmt(marketPrice(k))} gp &middot; vendor ${fmt(Math.floor(it.v*0.7))} gp &middot; stack ${fmt(it.v*n)} gp`];
    if(it.heal)tags.push(`heals ${it.heal}`);
    if(it.ammo)tags.push(`${it.ammo} · +${it.str} power`);
    if(eq){if(eq.str)tags.push(`+${eq.str} str`);if(eq.def)tags.push(`+${eq.def} def`);if(eq.acc)tags.push(`+${eq.acc}% ${eq.for||eq.type} accuracy`);tags.push(eq.slot);}
    h+=`<div class="bacts"><span>${tags.join(' · ')}</span><div class="acts">
      ${eq?`<button class="mini eq" data-equip="${k}">${worn?'Take off':'Equip'}</button>`:''}
      <button class="mini${pick&&pick.id===k&&pick.mode==='list'?' on':''}" data-pick="list:${k}" ${off(geFull,'Every Exchange slot is in use')}>List</button>
      <button class="mini${pick&&pick.id===k&&pick.mode==='sell'?' on':''}" data-pick="sell:${k}">Vendor</button></div></div>`;
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
    keys.map(k=>`<div class="pet${S.pets&&S.pets[k]?' got':''}">${art('pets',k)}${S.pets&&S.pets[k]?PETS[k]:'???'}
      <br><span style="color:var(--dim)">${k==='combat'?'Combat':label(k)}</span></div>`).join('')
  }</div>`;
}
/* Town is split into three sections so nothing sits 4,000 px down. The
   section is UI state only, like `tab`. */
/* Backup summaries for the Settings screen, read when it opens. */
const bakInfo={1:null,2:null};
async function readBaks(){for(const n of [1,2]){const raw=await Store.get(bakKey(curSlot,n));
  try{const o=raw?JSON.parse(raw):null;bakInfo[n]=o?{at:o.bakAt||o.last,lvl:summarize(o).lvl}:null;}catch(e){bakInfo[n]=null;}}}
const TOWN_SECS=[['market','Market'],['upgrades','Upgrades'],['settings','Settings']];
let townSec='market';
function viewShop(){
  let h=`<div class="seg town">${TOWN_SECS.map(([k,n])=>`<button class="mini${townSec===k?' on':''}" data-town="${k}">${n}</button>`).join('')}</div>`;
  return h+(townSec==='market'?townMarket():townSec==='upgrades'?townUpgrades():townSettings());
}
function townMarket(){
  let h='';
  h+=`<h2>The Exchange &middot; ${(S.offers||[]).length}/${geSlots()} slots</h2>`;
  if(!(S.offers||[]).length)h+=`<div class="empty">No offers. List items from the Bank tab, or buy materials below.</div>`;
  for(let i=0;i<(S.offers||[]).length;i++){
    const o=S.offers[i],mkt=marketPrice(o.id),pct=(o.filled/o.qty)*100;
    const diff=Math.round(((o.price-mkt)/mkt)*100);
    h+=`<div class="offer ${o.kind}">
      <div class="top"><b>${art('items',o.id)}${o.kind==='sell'?'Selling':'Buying'} ${fmt(o.qty)}× ${item(o.id).n}</b>
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
    h+=`<div class="row">${art('items',id)}<div class="grow"><b>${item(id).n}</b>
      <span>${fmt(mkt)} gp &middot; <span class="${diff<=0?'up':'down'}">${diff>0?'+':''}${diff}% vs base</span> &middot; you hold ${fmt(have(id))}</span></div>
      <button class="mini buy${pick&&pick.id===id&&pick.mode==='order'?' on':''}" data-pick="order:${id}" ${off(S.gp<mkt||(S.offers||[]).length>=geSlots(),S.gp<mkt?'Not enough gold':'Every Exchange slot is in use')}>Buy</button></div>`;
    h+=pickStrip(id,'order',mkt,Math.floor(S.gp/mkt),`you can afford ${fmt(Math.floor(S.gp/mkt))}`);
  }
  h+=`<h2>Seeds &amp; supplies</h2>`;
  for(const it of STOCK){
    const c=CROPS.find(x=>x.seed===it.id);
    const locked=c&&lvl('farming')<c.lvl;
    h+=`<div class="row">${art('items',it.id)}<div class="grow"><b>${item(it.id).n}</b>
      <span>${locked?`Farming ${c.lvl} required`:c?`Grows in ${Math.round(c.ms/60000)} min · ${c.harv} xp each`:'For mixing potions'} &middot; you have ${have(it.id)}</span></div>
      <button class="mini buy${pick&&pick.id===it.id&&pick.mode==='shop'?' on':''}" data-pick="shop:${it.id}" ${off(S.gp<it.cost||locked,locked?`Needs Farming ${c.lvl}`:'Not enough gold')}>${fmt(it.cost)} gp</button></div>`;
    if(!locked)h+=pickStrip(it.id,'shop',it.cost,Math.floor(S.gp/it.cost),`you can afford ${fmt(Math.floor(S.gp/it.cost))}`);
  }
  return h;
}
function townUpgrades(){
  let h='';
h+=`<h2>Tools</h2>`;
  for(const t in TOOLS){
    const cur=S.tools[t],next=TOOLS[t][cur+1];
    const lbl=t==='axe'?'Woodcutting':t==='pick'?'Mining':'Fishing';
    h+=`<div class="row">${art('tools',`${t}_${cur}`)}<div class="grow"><b>${TOOLS[t][cur].n}</b>
      <span>${lbl} · ${next?`next: ${next.n}, ${Math.round((1-next.mul)*100)}% faster`:'fully upgraded'}</span></div>
      ${!next?'':next.item
        ?`<button class="mini buy" data-tool="${t}" ${off(!have(next.item),`Needs a ${item(next.item).n}`)}>Fit</button>`
        :`<button class="mini buy" data-tool="${t}" ${off(S.gp<next.cost,`Needs ${fmt(next.cost-S.gp)} more gp`)}>${fmt(next.cost)} gp</button>`}</div>`;
    if(next&&next.item&&!have(next.item))h+=`<div class="empty" style="padding:2px 2px 10px">Needs a ${item(next.item).n} — forged at Smithing ${SKILLS.smithing.acts.find(a=>a.out&&a.out[next.item]).lvl}.</div>`;
  }
  h+=`<h2>Bank space</h2>`;
  const bt=S.bankTier||0,nextCap=BANK_TIERS[bt+1];
  h+=`<div class="row"><div class="grow"><b>${bankUsed()} / ${bankCap()} slots</b>
    <span>${nextCap?`Next: ${fmt(nextCap)} slots`:'Fully expanded'}</span></div>
    ${nextCap?`<button class="mini buy" data-bank="1" ${off(S.gp<BANK_COST[bt+1],`Needs ${fmt(BANK_COST[bt+1]-S.gp)} more gp`)}>${fmt(BANK_COST[bt+1])} gp</button>`:''}</div>`;

  h+=`<h2>Farm patches</h2>`;
  const pcost=[0,0,0,8000,40000,180000][S.patches]||null;
  h+=`<div class="row"><div class="grow"><b>${totalPatches()} patches</b>
    <span>${S.patches<6?'Sow one more crop in parallel':'All six bought — the Garden adds more'}</span></div>
    ${S.patches<6?`<button class="mini buy" data-patch="1" ${off(S.gp<pcost,`Needs ${fmt(pcost-S.gp)} more gp`)}>${fmt(pcost)} gp</button>`:''}</div>`;

  return h;
}
function townSettings(){
  let h='';
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
  h+=`<h2>Art</h2><div class="seg">${ART_STYLES.map(([k,n])=>`<button class="mini${(S.art||'off')===k?' on':''}" data-art="${k}">${n}</button>`).join('')}</div>`;
  h+=`<div class="empty">Pictures for items, in either style. Off shows text only and downloads nothing.</div>`;
  h+=`<h2>Buzz</h2><div class="seg">${[['on','On'],['off','Off']].map(([k,n])=>`<button class="mini${(S.buzz!==false)===(k==='on')?' on':''}" data-buzz="${k}">${n}</button>`).join('')}</div>`;
  h+=`<div class="empty">A short vibration on level-ups, claims and rare drops.</div>`;
  h+=`<h2>Notifications</h2>`;
  if(!native())h+=`<div class="empty">Available in the Android app.</div>`;
  else{
    const N=S.notify,blocked=N.on&&!native().canNotify();
    h+=`<div class="seg">${[['on','On'],['off','Off']].map(([k,n])=>`<button class="mini${N.on===(k==='on')?' on':''}" data-notify="${k}">${n}</button>`).join('')}</div>`;
    if(blocked)h+=`<div class="empty" style="color:var(--blood)">Android is blocking them. Allow notifications for Hollowmere in your phone's settings.</div>`;
    if(N.on)for(const [k,n] of NOTE_KINDS)h+=`<div class="row"><div class="grow"><b>${n}</b></div><button class="mini${N[k]?' on':''}" data-notekind="${k}">${N[k]?'On':'Off'}</button></div>`;
    h+=`<div class="empty">Only for things you set going. At most two at a time, merged when close together, never between 10 pm and 8 am, and none while the game is open.</div>`;
  }
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
  h+=`<h2>Backups</h2><div class="empty">Taken once an hour of play, two kept per slot.</div>`;
  for(const n of [1,2]){const b=bakInfo[n];
    h+=`<div class="row"><div class="grow"><b>${n===1?'Latest':'Earlier'} backup</b><span>${b?`${new Date(b.at).toLocaleString()} &middot; total level ${b.lvl}`:'none yet'}</span></div>
      ${b?`<button class="mini" data-bak="${n}">Restore</button>`:''}</div>`;}
  h+=`<h2>Restore</h2>`;
  h+=`<textarea class="savebox" id="loadtext" placeholder="Paste a save here, then tap Restore"></textarea>`;
  h+=`<div class="row"><div class="grow"><b>Restore</b><span>Replaces everything currently in this browser</span></div>
    <button class="mini" data-restore="1">Restore</button></div>`;
  h+=`<h2>Notes</h2><div class="empty">Weapons, armour and amulets are made, not bought — train Smithing and Crafting.</div>`;
  h+=`<h2>Danger zone</h2><div class="row"><div class="grow"><b>Reset save</b>
    <span>Wipes everything, permanently</span></div>
    <button class="mini" data-wipe="1">Reset</button></div>`;
  return h;
}

/* The style you would fight a raid in, and what it does there (8.9). A bow or
   staff with no ammo falls back to melee, as combatant() does. */
function raidStyle(){const st=style();return ammoKind(st)&&!bestAmmo(st)?'melee':st;}
function raidPerkText(st){
  const p=RAID.perk;
  return st==='ranged'?`Ranged: with your lane clear, you shoot raiders battering the wall next to you, at ${Math.round(p.farAcc*100)}% of your usual accuracy.`
    :st==='magic'?`Magic: each hit also scorches every other raider in your lane for ${Math.round(p.splash*100)}% of the damage.`
    :`Melee: the rest of a killing blow carries into the next raider, and the wall you hold mends ${p.mend} hp a second.`;
}
function raidPanel(){
  let h=`<div class="raid" id="raidpanel">
    <div class="hpline"><span id="rd-wave"></span><span class="num" id="rd-hp"></span></div>
    <div class="hpbar"><i id="rd-hpbar"></i></div>`;
  RAID.lanes.forEach((l,i)=>{
    h+=`<div class="lane" id="ln-${i}"><div class="grow">
        <div class="lane-top"><b>${art('raid',l.id)}${l.n}</b><span class="num" id="ln-wall-${i}"></span></div>
        <div class="wallbar"><i id="ln-wb-${i}"></i></div>
        <div class="track" id="ln-tr-${i}"></div></div>
      <div class="lane-acts"><button class="mini" data-lane="${i}" id="ln-go-${i}">Defend</button>
        <button class="mini" data-oil="${i}" id="ln-oil-${i}">Oil</button></div></div>`;
  });
  h+=`<div class="row"><div class="grow"><span>Tap Defend to run to a lane. Raiders you are not facing batter the wall. Oil burns the raider nearest the wall.</span>
    <span id="rd-perk">${raidPerkText(raidStyle())}</span></div>
    <button class="mini" data-leaveraid="1">Leave</button></div></div>`;
  return h;
}
/* Updates the raid panel in place every frame. Rebuilding it would swap the
   buttons out from under a finger mid-tap. */
function paintRaid(){
  if(!raid||!$('raidpanel'))return;
  const r=raid,R=RAID.raider(r.lvl),n=RAID.waves.length;
  $('rd-wave').textContent=r.wave<n?`Raid level ${r.lvl} · wave ${r.wave+1} of ${n}${r.waveT<0?' — next wave coming':''}`:`Raid level ${r.lvl}`;
  $('rd-hp').textContent=`${S.hp} / ${maxHp()} hp`;
  $('rd-hpbar').style.width=(S.hp/maxHp()*100)+'%';
  r.lanes.forEach((l,i)=>{
    const here=r.at===i,pct=l.wall/l.wallMax*100;
    $('ln-'+i).className='lane'+(here?' here':'');
    $('ln-wall-'+i).textContent=`${l.wall} / ${l.wallMax}`;
    const wb=$('ln-wb-'+i);wb.style.width=pct+'%';wb.className=pct<30?'low':pct<60?'mid':'';
    const f=raidFront(l);
    const aimed=here||(r.aim===l.id&&!r.moving);   // a ranged shot into this lane
    $('ln-tr-'+i).innerHTML=l.q.map(x=>`<i class="${x.walk<=0?'at':''}${x===f&&aimed?' tgt':''}" style="left:${(1-x.walk/RAID.walk)*92}%"></i>`).join('');
    const go=$('ln-go-'+i);
    go.textContent=here?(r.moving>0?'Running':'Here'):'Defend';
    go.classList.toggle('on',here);
    const oil=$('ln-oil-'+i);
    oil.textContent=r.oil>0?`Oil ${Math.ceil(r.oil/1000)}s`:'Oil';
    oil.disabled=r.oil>0||!l.q.length;
  });
}
/* What a room tier still lacks, as display strings; empty means buildable. */
function roomShort(c){
  const out=[];
  if(S.gp<(c.gp||0))out.push(`${fmt(c.gp-S.gp)} more gp`);
  for(const k in c)if(k!=='gp'&&have(k)<c[k])out.push(`${c[k]-have(k)}× ${item(k).n}`);
  return out;
}
function castleReady(){
  if(raid)return false;
  return ROOMS.some(r=>{const nt=room(r.id)+1;return nt<=r.max&&!roomShort(r.cost(nt)).length;});
}
function farmReady(){return S.farm.some((pt,i)=>i<totalPatches()&&pt.crop&&pt.ms<=0);}
function viewCastle(){
  let h='';
  if(raid)h+=raidPanel();
  else{
    const rp=S.ramparts,top=raidMaxLvl();
    h+=`<h2>Raids</h2>`;
    const scene=art('raid','scene');
    if(scene)h+=`<div class="raid-art">${scene}</div>`;
    h+=`<div class="row"><div class="grow"><b>${rp.best?`Best: level ${rp.best} repelled`:'No raid repelled yet'}</b>
      <span>Five waves down three lanes. Gold for every wave held, a chest for holding all five.
      ${rp.runs?`${rp.clears} of ${rp.runs} raids repelled.`:''} Starting a raid stops what you are doing.</span>
      <span>${raidPerkText(raidStyle())} Switch weapons on the Fight tab to change style.</span></div></div>`;
    if(lastRaid){
      const lr=lastRaid;
      h+=`<div class="row ${lr.won?'done':''}"><div class="grow"><b>Last raid: level ${lr.lvl} ${lr.won?'repelled':lr.why==='left'?'left':'lost'}</b>
        <span>${lr.waves} wave${lr.waves===1?'':'s'} held &middot; ${lr.kills} raiders &middot; ${fmt(lr.gp)} gp${lr.items.length?' &middot; chest: '+lr.items.join(', '):''}</span></div></div>`;
    }
    h+=`<div class="row picks">`;
    for(let L=1;L<=top;L++)h+=`<button class="mini${L===top?' buy':''}" data-raid="${L}">Level ${L}</button>`;
    h+=`</div>`;
    h+=`<div class="empty">Level ${top} raiders are level ${RAID.raider(top).lvl}. Walls and Barracks below make every raid easier.</div>`;
  }
  h+=`<h2>Your castle</h2>`;
  h+=`<div class="row"><div class="grow"><b>Passive bonuses</b>
    <span>Gold ×${goldMul().toFixed(2)} &middot; ${totalPatches()} patches &middot; ${bankCap()} bank slots
    &middot; crafting ${Math.round(room('workshop')*7)}% faster</span></div></div>`;
  for(const r of ROOMS){
    const t=room(r.id),nt=t+1;
    /* the room as it stands now; an unbuilt room shows tier I, dimmed */
    const pic=art('rooms',`${r.id}_${Math.max(1,t)}`);
    if(nt>r.max){h+=`<div class="row room done">${pic}<div class="grow"><b>${r.n} ${ROMAN[r.max]}</b><span>${r.desc(r.max)} &middot; complete</span></div></div>`;continue;}
    const c=r.cost(nt);
    const parts=Object.keys(c).map(k=>k==='gp'?`${fmt(c.gp)} gp`:`${c[k]}× ${item(k).n}`);
    const short=roomShort(c);
    h+=`<div class="row room${t?'':' unbuilt'}">${pic}<div class="grow"><b>${r.n}${t?' '+ROMAN[t]:''} ${t?'→ ':''}${ROMAN[nt]}</b>
      <span>${r.desc(nt)}<br>${parts.join(', ')}</span></div>
      <button class="mini buy" data-room="${r.id}" ${off(short.length,'Needs '+short.join(', '))}>Build</button></div>`;
  }
  return h;
}

function bodyHtml(){
  return tab==='train'?viewTrain():tab==='fight'?viewFight():tab==='quests'?viewQuestsTab()
    :tab==='diary'?viewDiaryTab():tab==='bank'?viewBank():tab==='castle'?viewCastle():viewShop();
}
let stashedRestoreText='';
let innerTouch=false,innerScrollAt=-1e9,touchUpAt=-1e9,paintOwed=false;
{
  const v=$('view'),inner=t=>t&&t.closest&&t.closest('[data-keep]');
  v.addEventListener('touchstart',e=>{if(inner(e.target))innerTouch=true;},{passive:true});
  const up=()=>{if(!innerTouch)return;innerTouch=false;innerScrollAt=touchUpAt=performance.now();
    setTimeout(()=>{if(paintOwed)repaint();},400);};
  v.addEventListener('touchend',up,{passive:true});v.addEventListener('touchcancel',up,{passive:true});
  v.addEventListener('scroll',e=>{if(e.target!==v&&inner(e.target)&&(innerTouch||performance.now()-touchUpAt<1500)){innerScrollAt=performance.now();
    setTimeout(()=>{if(paintOwed)repaint();},400);}},{capture:true,passive:true});
}
function repaint(){
  const v=$('view'),y=v.scrollTop;
  /* The view is rebuilt wholesale with innerHTML, which destroys and
     recreates every element inside it. Doing that while someone is typing
     rips the field out from under them: focus is lost, the soft keyboard
     closes, and any paste menu vanishes. So hold off entirely while a text
     field is in use, and carry its contents across rebuilds either way. */
  /* A rebuild mid-swipe on an inner list would cut the swipe off, so wait
     while a finger is down on one or it is still gliding. */
  if(innerTouch||performance.now()-innerScrollAt<350){paintOwed=true;return;}
  paintOwed=false;
  const ae=document.activeElement;
  if(ae&&(ae.tagName==='TEXTAREA'||ae.tagName==='INPUT')){
    if(ae.id==='loadtext')stashedRestoreText=ae.value;
    return;
  }
  const before=document.getElementById('loadtext');
  if(before)stashedRestoreText=before.value;
  // Every group carries a data-key and keeps the open/closed state the player
  // left it in, both ways, across rebuilds and tab switches. A group the
  // player has not touched yet follows its view's default.
  v.querySelectorAll('details.group').forEach(d=>{groupOpen[d.dataset.key]=d.open;});
  /* inner scrolling lists (the combat log) keep their place across rebuilds */
  const keep={};v.querySelectorAll('[data-keep]').forEach(el=>{keep[el.dataset.keep]=el.scrollTop;});
  v.innerHTML=bodyHtml();
  v.querySelectorAll('[data-keep]').forEach(el=>{if(el.dataset.keep in keep)el.scrollTop=keep[el.dataset.keep];});
  /* each tab's backdrop sits behind the page, already darkened into the page colour */
  v.style.backgroundImage=S.art==='lp'||S.art==='hd'?`url(./art/${S.art}/backdrops/${tab}.webp?v=${ART_V})`:'';
  v.querySelectorAll('details.group').forEach(d=>{
    if(d.dataset.key in groupOpen)d.open=groupOpen[d.dataset.key];
  });
  v.scrollTop=y;
  const after=document.getElementById('loadtext');
  if(after&&stashedRestoreText)after.value=stashedRestoreText;
  $('purse').innerHTML=`${fmt(S.gp)} <span>gp</span>`;
  // A pip means something on that tab is waiting for a tap.
  const pip=(t,nm,on)=>{const b=document.querySelector(`nav button[data-tab="${t}"]`),h=navBtn(t,nm,on);if(b.innerHTML!==h)b.innerHTML=h;};
  pip('train','Train',farmReady());
  pip('quests','Quests',questsReady()||errandsReady()>0||S.well.charges>0||casketsReady());
  pip('diary','Diary',diaryReady()||(S.clogNew||[]).length>0);
  pip('castle','Castle',castleReady());
  pip('fight','Fight',false);pip('bank','Bank',false);pip('shop','Town',false);
}
/* Nav line icons (9.4), drawn inline so they follow the text colour. */
const NAV_ICONS={"train":"<path d=\"M4.5 19.5 L15.5 8.5\"/><path d=\"M8.5 4 Q18.5 2.5 20 15.5 Q17.5 7 8.5 4 Z\"/>",
  "fight":"<path d=\"M9 15 L19.5 4.5\"/><path d=\"M6 12 L12 18\"/><path d=\"M8 16 L5 19\"/><path d=\"M15 15 L4.5 4.5\"/><path d=\"M12 18 L18 12\"/><path d=\"M16 16 L19 19\"/>",
  "quests":"<path d=\"M8 4 H17.5 a2 2 0 0 1 2 2 V17\"/><path d=\"M8 4 a2.5 2.5 0 0 0 -2.5 2.5 V8 H8.5\"/><path d=\"M8.5 6.5 V18 a2.5 2.5 0 0 0 2.5 2.5 H18 a2.5 2.5 0 0 0 0-5 H13\"/><path d=\"M11.5 9.5 H16.5 M11.5 12.5 H16.5\"/>",
  "diary":"<path d=\"M12 6 C9.5 4.5 6.5 4.5 4 5.5 V19 C6.5 18 9.5 18 12 19.5 C14.5 18 17.5 18 20 19 V5.5 C17.5 4.5 14.5 4.5 12 6 Z\"/><path d=\"M12 6 V19.5\"/>",
  "bank":"<path d=\"M3.5 11 V9 C3.5 5.5 7 4 12 4 C17 4 20.5 5.5 20.5 9 V11\"/><path d=\"M3.5 11 H20.5 V20 H3.5 Z\"/><path d=\"M10 9 H14 V14.5 H10 Z\"/><path d=\"M7 4.6 V11 M17 4.6 V11\"/>",
  "castle":"<path d=\"M4.5 20 V4.5 H7.5 V8.5 H10.5 V4.5 H13.5 V8.5 H16.5 V4.5 H19.5 V20 Z\"/><path d=\"M10 20 V15.5 a2 2 0 0 1 4 0 V20\"/>",
  "shop":"<path d=\"M3.5 11 L12 4.5 L20.5 11\"/><path d=\"M6 9.5 V20 H18 V9.5\"/><path d=\"M10 20 V15 H14 V20\"/>"};
function navBtn(t,nm,on){
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${NAV_ICONS[t]}</svg><span>${nm}${on?'<span class="pip"></span>':''}</span>`;
}
function render(){
  renderDoing();repaint();
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
}

/* ============================================================
   INPUT
   ============================================================ */
/* Each tab reopens where it was left; a tab not visited yet starts at the top. */
function goTab(t,sec){
  if(t==='shop')readBaks().then(()=>{if(tab==='shop')repaint();});
  const v=$('view'),key=()=>tab==='shop'?'shop:'+townSec:tab;
  tabScroll[key()]=v.scrollTop;
  if(tab==='diary'&&diarySec==='log'&&t!=='diary')S.clogNew=[];
  tab=t;if(sec)townSec=sec;pick=null;bankOpen=null;render();
  v.scrollTop=tabScroll[key()]||0;
}
/* Brings a skill's list into view on the Train tab, opened. */
function revealSkill(k){
  if(COMBAT_SKILLS.includes(k)&&k!=='farming'){goTab('fight');return;}
  if(tab!=='train')goTab('train');else render();
  const v=$('view'),el=$(SKILLS[k]?'grp-'+k:'farm');
  if(el&&SKILLS[k])el.open=groupOpen['train-'+k]=true;
  if(el)v.scrollTop+=el.getBoundingClientRect().top-v.getBoundingClientRect().top-6;
}
document.querySelector('nav').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;goTab(b.dataset.tab);
});
$('doing').addEventListener('click',()=>{
  if(raid){goTab('castle');return;}
  const cur=findAct(S.act);
  if(!cur){goTab('train');return;}
  if(cur.skill==='fight'||cur.skill==='delve'){goTab('fight');return;}
  revealSkill(cur.skill);
});
$('view').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.getAttribute('aria-disabled')==='true'){toast(b.dataset.why||'Not available yet');return;}
  if(b.dataset.skill){revealSkill(b.dataset.skill);return;}
  if(b.dataset.pin){S.pin=S.pin===b.dataset.pin?null:b.dataset.pin;toast(S.pin?'Goal pinned':'Goal unpinned');render();save();return;}
  if(b.dataset.goal){
    const[k,a,c]=b.dataset.goal.split(':');
    if(k==='skill')revealSkill(a);
    else if(k==='combat')goTab('fight');
    else if(k==='diary')goTab('diary');
    else if(k==='quest')goTab('quests');
    else if(k==='room')goTab('castle');
    return;
  }
  if(b.dataset.fsec){fightSec=b.dataset.fsec;render();return;}
  if(b.dataset.qsec){questSec=b.dataset.qsec;pick=null;render();return;}
  if(b.dataset.errand){handInErrand(b.dataset.errand);render();save();return;}
  if(b.dataset.swap){swapErrand(b.dataset.swap);render();save();return;}
  if(b.dataset.well){useWell();render();save();return;}
  if(b.dataset.trail){openTrail(b.dataset.trail);render();save();return;}
  if(b.dataset.casket){openCasket(b.dataset.casket);render();save();return;}
  if(b.dataset.guild){
    if(b.dataset.guild==='tome'){pick=pick&&pick.mode==='tome'?null:{id:'tome',mode:'tome'};render();return;}
    guildBuy(b.dataset.guild);render();save();return;}
  if(b.dataset.tome){guildBuy('tome',b.dataset.tome);pick=null;render();save();return;}
  if(b.dataset.dsec){
    if(diarySec==='log'&&b.dataset.dsec!=='log')S.clogNew=[];   // seen once you leave it
    diarySec=b.dataset.dsec;render();return;}
  if(b.dataset.style){
    const k=b.dataset.style;if(style()===k)return;
    const w=bestWeapon(k);if(!w&&k!=='melee')return;   // no melee weapon means fists
    S.equip.weapon=w;toast(w?`Wielding ${item(w).n}`:'Fighting unarmed');render();save();return;
  }
  if(b.dataset.town){goTab('shop',b.dataset.town);return;}
  if(b.dataset.bfilter){bankFilter=b.dataset.bfilter;bankOpen=null;pick=null;render();$('view').scrollTop=0;return;}
  if(b.dataset.bsort){bankSort=b.dataset.bsort;render();return;}
  if(b.dataset.art){S.art=b.dataset.art;render();save();return;}
  if(b.dataset.notify){S.notify.on=b.dataset.notify==='on';S.notify.asked=true;if(S.notify.on&&native()&&!native().canNotify())native().askNotify();render();save();return;}
  if(b.dataset.notekind){const k=b.dataset.notekind;S.notify[k]=!S.notify[k];render();save();return;}
  if(b.dataset.buzz){S.buzz=b.dataset.buzz==='on';if(S.buzz)buzz();render();save();return;}
  if(b.dataset.brow){const k=b.dataset.brow;bankOpen=bankOpen===k?null:k;pick=null;render();return;}
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
    if(mode==='list'&&(S.offers||[]).length>=geSlots()){toast('No free offer slots');return;}
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
    if(!next)return;
    if(next.item){if(!have(next.item))return;take(next.item,1);S.tools[t]++;toast(`Fitted ${next.n}`);render();save();return;}
    if(S.gp<next.cost)return;
    S.gp-=next.cost;S.tools[t]++;toast(`Bought ${next.n}`);render();save();return;
  }
  if(b.dataset.tier){
    const [id,i]=b.dataset.tier.split(':');const d=DIARY.find(x=>x.id===id);
    if(d)claimTier(d,+i);
    render();save();return;
  }
  if(b.dataset.dcape){awardDiaryCape();render();save();return;}
  if(b.dataset.quest){
    const q=QUESTS.find(x=>x.id===b.dataset.quest);if(q)claimQuest(q);
    render();save();return;
  }
  if(b.dataset.cloak){awardCloak();render();save();return;}
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
  if(b.dataset.bak){
    const n=+b.dataset.bak;
    Store.get(bakKey(curSlot,n)).then(raw=>{
      if(!raw)return;
      if(!confirm('Go back to this backup? Progress since then is lost.'))return;
      try{const p=JSON.parse(raw);adopt(p);if(!S.task)rollTask();S.last=Date.now();render();save();toast('Backup restored');}
      catch(e){toast('That backup could not be read');}
    });
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
    adopt(p);            // same migration as loading a slot
    if(!S.task)rollTask();
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
    if(o.kind==='sell')add(o.id,left,true);else S.gp+=left*o.price;
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
  if(b.dataset.raid){
    if(startRaid(+b.dataset.raid)){goTab('castle');save();}
    return;
  }
  if(b.dataset.lane){if(raid)raidMove(raid,+b.dataset.lane);paintRaid();return;}
  if(b.dataset.oil){raidPlayerOil(+b.dataset.oil);paintRaid();return;}
  if(b.dataset.leaveraid){if(raid)endRaid({won:false,why:'left'});render();save();return;}
  if(b.dataset.room){
    const r=ROOMS.find(x=>x.id===b.dataset.room);if(!r)return;
    const nt=room(r.id)+1;if(nt>(r.max||3))return;
    const c=r.cost(nt);
    if(S.gp<(c.gp||0))return;
    for(const k in c)if(k!=='gp'&&have(k)<c[k])return;
    S.gp-=(c.gp||0);
    for(const k in c)if(k!=='gp')take(k,c[k]);
    S.house[r.id]=nt;
    if(r.id==='garden')while(S.farm.length<totalPatches())S.farm.push({crop:null,ms:0});
    toast(`${r.n} ${ROMAN[nt]} built`);render();save();return;
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
    const got=add(c.out,n);countMade(c.out,got);grantXp('farming',c.harv);
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
  if(raidEnded){raidEnded=false;sinceFull=0;save();repaint();}
  else if(raid&&tab==='castle'&&$('raidpanel')){paintRaid();if(before!==S.act)repaint();}
  else if(sinceFull>800||before!==S.act){sinceFull=0;errandTick(Date.now());trailTick();goalCheck();repaint();}
  sinceSave+=dt;if(sinceSave>10000){sinceSave=0;save();}
  requestAnimationFrame(loop);
}
/* The welcome-back card sits outside the view, so it gets its own handler. */
$('wb').addEventListener('click',e=>{
  const b=e.target.closest('button[data-notifyask]');if(!b)return;
  S.notify.asked=true;
  if(b.dataset.notifyask==='yes'){S.notify.on=true;if(native()&&!native().canNotify())native().askNotify();toast('Notifications on — change them in Town, Settings');}
  b.closest('li').remove();save();
});
document.addEventListener('visibilitychange',()=>{
  // Raids never run in the background. Waves already held were paid out.
  if(document.hidden){if(raid)endRaid({won:false,why:'left'});save();scheduleNotices();}
  else{clearNotices();const r=catchUp();lastFrame=Date.now();render();showCatchUp(r);}
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
    if(Updater.state==='ready')toast(`Version ${Updater.latest} available — Town, Settings`);
  },4000);
})();
