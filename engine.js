
/* ------------------------------------------------------------------
   Self-updating. The service worker serves the page network-first, so a
   new upload is normally picked up on the next launch. This adds an
   explicit check + one-tap apply for when you don't want to wait.
   ------------------------------------------------------------------ */
const Updater={
  supported:(typeof navigator!=='undefined')&&('serviceWorker' in navigator)
            &&location.protocol.indexOf('http')===0,
  state:'idle',      // idle | checking | current | ready | offline
  latest:null,
  async register(){
    if(!this.supported)return;
    try{await navigator.serviceWorker.register('./sw.js');}catch(e){this.supported=false;}
  },
  async check(){
    if(!this.supported){this.state='idle';return;}
    this.state='checking';repaint();
    try{
      const res=await fetch('./index.html?v='+Date.now(),{cache:'no-store'});
      if(!res.ok)throw new Error('bad response');
      const text=await res.text();
      const m=text.match(/APP_VERSION\s*=\s*'([^']+)'/);
      if(!m)throw new Error('no version found');
      this.latest=m[1];
      this.state=(m[1]!==APP_VERSION)?'ready':'current';
    }catch(e){this.state='offline';}
    repaint();
  },
  async apply(){
    if(this.state!=='ready')return;
    await save();                              // never update over unsaved progress
    try{
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }catch(e){}
    try{
      const reg=await navigator.serviceWorker.getRegistration();
      if(reg){if(reg.waiting)reg.waiting.postMessage('SKIP_WAITING');await reg.update();}
    }catch(e){}
    location.reload();
  }
};
/* ============================================================
   STATE
   ============================================================ */
/* ------------------------------------------------------------------
   Storage adapter. Inside Claude we use window.storage. Installed as a
   PWA or opened as a plain file there is no such thing, so fall back to
   localStorage, then to memory. localStorage is only probed when
   window.storage is absent, so the artifact path never touches it.
   ------------------------------------------------------------------ */
const Store=(function(){
  const mem={};
  const artifact=(typeof window!=='undefined')&&window.storage&&typeof window.storage.get==='function';
  let local=false;
  if(!artifact){
    try{localStorage.setItem('__hm_probe','1');localStorage.removeItem('__hm_probe');local=true;}
    catch(e){local=false;}
  }
  return{
    mode:artifact?'Claude':local?'this device':'memory only (nothing will persist)',
    persistent:artifact||local,
    async get(k){
      if(artifact){try{const r=await window.storage.get(k);return r&&r.value!==undefined?r.value:null;}catch(e){return null;}}
      if(local){try{return localStorage.getItem(k);}catch(e){return null;}}
      return mem[k]!==undefined?mem[k]:null;
    },
    async set(k,v){
      if(artifact){try{await window.storage.set(k,v);return true;}catch(e){return false;}}
      if(local){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}
      mem[k]=v;return true;
    },
    async del(k){
      if(artifact){try{await window.storage.delete(k);return true;}catch(e){return false;}}
      if(local){try{localStorage.removeItem(k);return true;}catch(e){return false;}}
      delete mem[k];return true;
    },
  };
})();
const SLOTS_N=3;
const slotKey=i=>`hollowmere:slot:${i}`;
const META='hollowmere:meta';
const SAVE='hollowmere:save:v2';   // legacy single-slot key, imported once
/* Save schema version. Bump it when the shape of S changes, and migrate older
   saves in adopt() by checking p.v (absent = a save from before 7.1). */
const SAVE_VERSION=2;   // 2: S.ramparts (castle defence)
function fresh(){
  const xp={};for(const k of ALL_SKILLS)xp[k]=0;
  xp.hitpoints=XP[9];
  /* Starter kit (8.5): food so the first fights don't stall (HP doesn't regenerate),
     and seeds and gold so Farming can start at once. Old saves are untouched. */
  return{v:SAVE_VERSION,xp,bank:{minnow:15,seed_bitterleaf:3},gp:100,tools:{axe:0,pick:0,rod:0},
    equip:{weapon:null,shield:null,head:null,body:null,amulet:null},
    hp:10,act:null,prog:0,foe:null,foeHp:0,foeTimer:0,stun:0,
    kills:{},quests:{},task:null,capes:{},log:[],
    sess:{kills:0,gp:0,dealt:0,taken:0,eaten:0,deaths:0,swings:0,hits:0},
    farm:[{crop:null,ms:0},{crop:null,ms:0},{crop:null,ms:0}],patches:3,
    buffs:{},bankTier:0,bossKills:{},delve:null,deepest:{},made:{},cleared:{},diary:{},tasksDone:0,
    house:{altar:0,workshop:0,garden:0,kitchen:0,storeroom:0,trophy:0,walls:0,barracks:0},
    ramparts:{best:0,runs:0,clears:0},
    market:{},offers:[],geMs:0,pets:{},art:'hd',pin:null,buzz:true,notify:{on:false,asked:false,stop:true,farm:true,cap:true},errands:{board:[],stock:3,at:0,done:0},trails:{},trailsDone:{},well:{charges:1,at:0},marks:0,guild:{},clog:{},clogNew:[],clogRank:0,started:Date.now(),played:0,last:Date.now()};
}
let S;
function lvl(s){return lvlFor(S.xp[s]||0);}
function maxHp(){return lvl('hitpoints');}
function gear(){
  let str=0,def=0,spd=2800;const acc={};
  for(const sl of SLOTS){const id=S.equip[sl];if(!id||!EQ[id])continue;
    const e=EQ[id];str+=e.str||0;def+=e.def||0;if(sl==='weapon'&&e.spd)spd=e.spd;
    const fs=e.for||e.type;if(e.acc&&fs)acc[fs]=(acc[fs]||0)+e.acc;}   // style accuracy, 8.2
  return{str,def,spd,acc};
}
function style(){
  const id=S.equip.weapon;
  return id&&EQ[id]&&EQ[id].type?EQ[id].type:'melee';
}
function ammoKind(st){return st==='ranged'?'arrow':st==='magic'?'rune':null;}
function bestAmmo(st){
  const kind=ammoKind(st);if(!kind)return null;
  const opts=Object.keys(S.bank).filter(k=>I[k]&&I[k].ammo===kind&&S.bank[k]>0);
  if(!opts.length)return null;
  opts.sort((a,b)=>I[b].str-I[a].str);
  return opts[0];
}
function styleLvl(st){return st==='ranged'?lvl('ranged'):st==='magic'?lvl('magic'):lvl('attack');}
function powerLvl(st){return st==='ranged'?lvl('ranged'):st==='magic'?lvl('magic'):lvl('strength');}
function maxHitFor(st,G,P,ammo){
  const bonus=(ammo?I[ammo].str:0)+G.str+(st==='melee'?buffTotal('str'):0);
  return 1+Math.floor((powerLvl(st)+bonus)/6)+P.hit;
}
/* Counts the best of the three styles, so an archer or a mage levels up like a
   fighter. A melee player's level is exactly what it was before 8.1, and no
   level can go down: Attack + Strength is still one of the options. */
function combatLvl(){
  const off=Math.max(lvl('attack')+lvl('strength'),2*lvl('ranged'),2*lvl('magic'));
  return Math.floor((lvl('defence')+lvl('hitpoints')+off)/4);
}
/* Best owned weapon of a style, by power. Melee weapons carry no type. */
function bestWeapon(st){
  const ids=Object.keys(S.bank).filter(k=>S.bank[k]>0&&EQ[k]&&EQ[k].slot==='weapon'&&(EQ[k].type||'melee')===st);
  ids.sort((a,b)=>(EQ[b].str||0)-(EQ[a].str||0)||(EQ[a].spd||2800)-(EQ[b].spd||2800));
  return ids[0]||null;
}
/* One arrow in three is picked up again. Runes are always spent. */
const ARROW_KEEP=1/3;
function spendAmmo(id){
  if(I[id].ammo==='arrow'&&Math.random()<ARROW_KEEP)return;
  take(id,1);
}
function have(id){return S.bank[id]||0;}
function marketMul(id){return (S.market&&S.market[id])||1;}
function marketPrice(id){return Math.max(1,Math.round(item(id).v*marketMul(id)));}
function driftMarket(){
  if(!S.market)S.market={};
  const ids=new Set([...Object.keys(S.bank),...Object.keys(S.market),
    ...(S.offers||[]).map(o=>o.id),...BUYABLE]);
  for(const id of ids){
    if(!I[id]&&!EQ[id])continue;
    let m=marketMul(id);
    m+=(Math.random()-0.5)*0.09;
    m+=(1-m)*0.06;                       // pulls back toward base value over time
    S.market[id]=Math.min(1.6,Math.max(0.62,m));
  }
}
function fillOffers(){
  if(!S.offers)return;
  for(const o of S.offers){
    if(o.filled>=o.qty)continue;
    const mkt=marketPrice(o.id);
    const ratio=o.kind==='sell'?mkt/o.price:o.price/mkt;   // above 1 means your price is attractive
    const speed=ratio>=1?0.28*Math.min(2.5,ratio):0.28*Math.pow(ratio,4);
    // Round the fractional part by chance: a plain floor meant a listing of one
    // or two items could never reach a whole unit, so it sat unsold forever.
    const raw=o.qty*speed*(0.6+Math.random()*0.8);
    const want=Math.floor(raw)+(Math.random()<raw%1?1:0);
    if(want<=0)continue;
    const take=Math.min(want,o.qty-o.filled);
    if(o.kind==='sell'){o.filled+=take;S.gp+=take*o.price;o.got=(o.got||0)+take*o.price;}
    else{const g=add(o.id,take,true);o.filled+=g;o.got=(o.got||0)+g;if(g<take)break;}
  }
  const done=S.offers.filter(o=>o.filled>=o.qty);
  if(done.length){
    for(const o of done)pushLog(`${o.kind==='sell'?'Sold':'Bought'} ${fmt(o.qty)}× ${item(o.id).n}`,'loot');
    if(gains)gains.trades=(gains.trades||0)+done.length;
  }
  S.offers=S.offers.filter(o=>o.filled<o.qty);
}
function geTick(dt){
  S.geMs=(S.geMs||0)+dt;
  let n=0;
  while(S.geMs>=GE_TICK&&n++<400){S.geMs-=GE_TICK;driftMarket();fillOffers();}
}
function rollPet(key,dur){
  const id=PETS[key]?key:'combat';
  if(S.pets&&S.pets[id])return;
  if(Math.random()<dur/PET_DENOM){
    if(!S.pets)S.pets={};
    S.pets[id]=1;
    logNew('pet:'+id);
    if(gains)gains.pets=(gains.pets||[]).concat(PETS[id]);
    else{pushLog(`A ${PETS[id]} follows you home!`,'kill');toast(`Pet: ${PETS[id]}`);buzz('big');}
  }
}
function room(id){return (S.house&&S.house[id])||0;}
function ringGold(){const r=S.equip.ring;return r&&EQ[r]&&EQ[r].gold?EQ[r].gold:0;}
/* combat is true for gold from fighting — kills, clears, slayer tasks and a
   banked delve haul — which is all the Combat diary's gold perk touches. */
function goldMul(combat){return 1+room('trophy')*0.07+ringGold()+(combat?diaryPerk('combatGold')*0.05:0);}
function gainGp(n,combat){const g=Math.round(n*goldMul(combat));S.gp+=g;noteGp(g);return g;}
function totalPatches(){const d=diaryPerk('patch');return Math.min(10+d,(S.patches||3)+room('garden')+d);}
function geSlots(){return GE_SLOTS+diaryPerk('offer');}
/* Bank capacity is SLOTS — distinct item types. Stacks are unlimited, the way
   they are in RuneScape. An over-cap save (from before the switch) keeps
   everything it holds and is only blocked from taking on NEW item types, so
   nobody loses anything on the changeover. */
function bankCap(){return BANK_TIERS[S.bankTier||0]+room('storeroom')*8+diaryPerk('bank')*8+((S.guild||{}).bank||0)*4;}
function bankUsed(){let n=0;for(const k in S.bank)if(S.bank[k]>0)n++;return n;}
function bankFull(){return bankUsed()>=bankCap();}
function hasSlot(id){return !!S.bank[id]||bankUsed()<bankCap();}
// How many free slots a set of incoming ids would consume.
function slotsFor(ids){let n=0;for(const id of ids)if(!S.bank[id])n++;return n;}
/* bought: true for gold-for-goods paths (the shop, a buy offer filling, an
   offer cancelled back into the bank), which never fill the collection log. */
function add(id,n,bought){
  if(!hasSlot(id)){pushLog(`No free bank slot — ${n}× ${item(id).n} lost`,'miss');return 0;}
  S.bank[id]=(S.bank[id]||0)+n;
  if(!bought&&n>0)logGot(id,n);
  return n;
}
function take(id,n){S.bank[id]=(S.bank[id]||0)-n;if(S.bank[id]<=0)delete S.bank[id];}
/* Only strip the item off you if the last one actually left the bank — the old
   sell-everything handler could unequip on a partial sale. */
function unequipIfGone(id){if(!have(id)&&EQ[id]&&S.equip[EQ[id].slot]===id)S.equip[EQ[id].slot]=null;}
function vendor(id,n){
  n=Math.min(n,have(id));if(n<=0)return;
  const val=Math.floor(item(id).v*0.7)*n;
  take(id,n);unequipIfGone(id);
  S.gp+=val;toast(`Vendored ${fmt(n)}× ${item(id).n} for ${fmt(val)} gp`);
}
function listOffer(id,n){
  n=Math.min(n,have(id));if(n<=0)return;
  if((S.offers||[]).length>=geSlots()){toast('No free offer slots');return;}
  take(id,n);unequipIfGone(id);
  S.offers.push({uid:offerUid(),kind:'sell',id,qty:n,filled:0,price:marketPrice(id)});
  toast(`Listed ${fmt(n)}× ${item(id).n}`);
}
function offerUid(){return 'o'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
/* Offers are addressed by uid, not array index: fillOffers splices completed
   offers out on a timer, and an index captured when a panel opened would then
   point at somebody else's offer. */
function adoptOffers(list){
  const out=Array.isArray(list)?list:[];
  for(const o of out)if(!o.uid)o.uid=offerUid();
  return out;
}
/* A buy offer has already paid price*qty up front, so repricing has to settle
   the difference on whatever is still unfilled — refunding when the bid drops,
   not just charging when it rises. */
function repriceOffer(o,price){
  price=Math.max(1,Math.round(price));
  if(price===o.price)return true;
  if(o.kind==='buy'){
    const delta=(price-o.price)*(o.qty-o.filled);
    if(delta>0&&S.gp<delta){toast('Not enough gold to raise the bid');return false;}
    S.gp-=delta;
  }
  o.price=price;
  toast(`Price set to ${fmt(price)} gp`);
  return true;
}
function buyOffer(id,n){
  if((S.offers||[]).length>=geSlots()){toast('No free offer slots');return;}
  // A buy offer delivers through add() whenever it fills, which could be hours
  // later. Refuse it now rather than have the gold spent and the goods dropped
  // on arrival because there was no slot waiting.
  if(!hasSlot(id)){toast(`No free bank slot for ${item(id).n}`);return;}
  const price=marketPrice(id);
  n=Math.min(n,Math.floor(S.gp/price));
  if(n<1){toast('Not enough gold');return;}
  S.gp-=price*n;
  S.offers.push({uid:offerUid(),kind:'buy',id,qty:n,filled:0,price});
  toast(`Buying ${fmt(n)}× ${item(id).n}`);
}
function shopBuy(id,n){
  const st=STOCK.find(x=>x.id===id);if(!st)return;
  const c=CROPS.find(x=>x.seed===id);
  if(c&&lvl('farming')<c.lvl){toast(`Farming ${c.lvl} required`);return;}
  if(!hasSlot(id)){toast('No free bank slot');return;}
  n=Math.min(n,Math.floor(S.gp/st.cost));
  if(n<1){toast('Not enough gold');return;}
  S.gp-=st.cost*n;add(id,n,true);
  toast(`Bought ${fmt(n)}× ${item(id).n}`);
}
function canPay(inp){if(!inp)return true;for(const k in inp)if(have(k)<inp[k])return false;return true;}

function findAct(key){
  if(!key)return null;
  const[sk,id]=key.split(':');
  if(sk==='fight')return{skill:'fight',foe:allFoes().find(f=>f.id===id)};
  if(sk==='delve'){
    const d=DUNGEONS.find(x=>x.id===id);if(!d)return null;
    const fl=(S.delve&&S.delve.id===id)?S.delve.floor:0;
    return{skill:'delve',d,foe:delveFoe(d,fl)};
  }
  const s=SKILLS[sk];if(!s)return null;
  const a=s.acts.find(x=>x.id===id);if(!a)return null;
  return{skill:sk,a};
}
const CRAFT_SKILLS=['smithing','crafting','fletching'];
const GATHER_SKILLS=['woodcutting','mining','fishing'];
function actDur(sk,a){
  const t=SKILLS[sk].tool;
  let d=t?a.dur*TOOLS[t][S.tools[t]].mul:a.dur;
  if(CRAFT_SKILLS.includes(sk))d*=(1-room('workshop')*0.07-diaryPerk('craftSpeed')*0.05);
  if(GATHER_SKILLS.includes(sk))d*=(1-diaryPerk('gatherSpeed')*0.05);
  return Math.max(500,d);
}

/* ============================================================
   ENGINE
   ============================================================ */
let gains=null;
function grantXp(sk,amount){
  if(!amount)return;
  if(sk==='prayer')amount=Math.round(amount*(1+room('altar')*0.15));
  if(sk==='slayer')amount=Math.round(amount*(1+diaryPerk('slayerXp')*0.10));
  if(sk===fairSkill())amount=Math.round(amount*(1+FAIR.bonus));
  const before=lvlFor(S.xp[sk]||0);
  S.xp[sk]=Math.min(XP[98],(S.xp[sk]||0)+amount);
  const after=lvlFor(S.xp[sk]);
  if(gains)gains.xp[sk]=(gains.xp[sk]||0)+amount;
  if(after>before){
    if(gains){gains.lvls=gains.lvls||{};if(!gains.lvls[sk])gains.lvls[sk]=[before,after];else gains.lvls[sk][1]=after;}
    if(after===99&&!S.capes[sk]){S.capes[sk]=1;add(sk+'_cape',1);
      if(gains)gains.capes.push(sk);else{toast(`${label(sk)} 99 — cape earned`);buzz('big');}}
    else if(!gains){toast(`${label(sk)} level ${after}`);buzz();}
    if(!gains)goalCheck();
  }
}
function fairWeek(now){return Math.floor((now-345600000)/604800000);}   // weeks since Monday 5 Jan 1970
function fairSkill(now){const w=fairWeek(now||Date.now());return ALL_SKILLS[((w*FAIR.stride)%ALL_SKILLS.length+ALL_SKILLS.length)%ALL_SKILLS.length];}
function fairEnds(now){now=now||Date.now();return (fairWeek(now)+1)*604800000+345600000-now;}
function label(k){return SKILLS[k]?SKILLS[k].n:cap0(k);}
function noteItem(id,n){if(gains)gains.items[id]=(gains.items[id]||0)+n;}
function noteGp(n){if(gains)gains.gp+=n;}

const EVENTS=[
  {t:'A travelling merchant tips you',gp:()=>150+Math.floor(Math.random()*400)},
  {t:'You find a coin purse in the dirt',gp:()=>80+Math.floor(Math.random()*250)},
  {t:'A stranger hands you a gem',item:'uncut_sapphire'},
  {t:'You unearth an old cache',item:'uncut_emerald'},
];
function maybeEvent(){
  if(Math.random()>=0.004)return;   // ~1 in 250 completed actions
  const e=EVENTS[Math.floor(Math.random()*EVENTS.length)];
  if(e.gp){const n=e.gp();S.gp+=n;noteGp(n);if(gains)gains.events++;else toast(`${e.t} — ${n} gp`);}
  else{add(e.item,1);noteItem(e.item,1);if(gains)gains.events++;else toast(`${e.t} — ${item(e.item).n}`);}
}

function farmTick(dt){
  if(!S.farm)return;
  for(const p of S.farm)if(p.crop&&p.ms>0)p.ms=Math.max(0,p.ms-dt);
}
function buffTick(dt){
  for(const k in S.buffs){S.buffs[k].ms-=dt;if(S.buffs[k].ms<=0)delete S.buffs[k];}
}
function buffTotal(k){return S.buffs[k]?S.buffs[k].amt:0;}
/* Drink whatever actually improves you, not whatever is most expensive.
   The old version sorted by gp value and only ever considered the single
   priciest stack, so an attack potion was never drunk while anything dearer
   sat in the bank. It also bailed as soon as ONE key was already satisfied,
   which let a lone +8 acc block a combat potion's str and def entirely.
   Now: score each potion by the buff it would genuinely add, drink the best,
   and loop so several keys can be topped up from different potions. */
function drinkIfNeeded(){
  for(let guard=0;guard<4;guard++){
    let best=null,bestGain=0;
    for(const k in S.bank){
      const def=I[k];
      if(!def||!def.buff||S.bank[k]<=0)continue;
      let gain=0;
      for(const b in def.buff)gain+=Math.max(0,def.buff[b]-buffTotal(b));
      if(gain>bestGain){bestGain=gain;best=k;}
    }
    if(!best)return;                     // nothing in the bank would improve on what is active
    const def=I[best];
    take(best,1);
    // Only raise a key, never lower it — a weaker potion must not stomp a
    // stronger buff that is still running.
    for(const b in def.buff)if(def.buff[b]>buffTotal(b))S.buffs[b]={amt:def.buff[b],ms:def.ms};
    pushLog(`Drank ${def.n} — ${Object.entries(def.buff).map(([k,v])=>'+'+v+' '+k).join(', ')} for ${Math.round(def.ms/60000)} min`,'eat');
  }
}

function tick(dt){
  S.played=(S.played||0)+dt;
  farmTick(dt);buffTick(dt);geTick(dt);
  // A raid pauses everything else. Starting any activity ends it.
  if(raid){if(S.act)endRaid({won:false,why:'left'});else{raidTick(dt);return;}}
  if(S.stun>0){S.stun=Math.max(0,S.stun-dt);if(S.stun>0)return;}
  const cur=findAct(S.act);
  if(!cur)return;
  if(cur.skill==='fight'||cur.skill==='delve'){fightTick(dt,cur.foe);return;}
  const{skill,a}=cur;
  if(lvl(skill)<a.lvl){S.act=null;return;}
  S.prog+=dt;
  const dur=actDur(skill,a);
  let guard=0;
  while(S.prog>=dur&&guard++<600){
    if(!canPay(a.in)){S.prog=0;if(!gains)toast('Out of materials');else stopNote(`${a.n} ran out of materials`);S.act=null;return;}
    if(a.out&&slotsFor(Object.keys(a.out))>bankCap()-bankUsed()){
      S.prog=0;if(!gains)toast('No free bank slot');else stopNote(`${a.n} stopped — the bank is full`);S.act=null;return;}
    S.prog-=dur;
    if(a.fail!==undefined&&Math.random()<a.fail){
      grantXp(skill,Math.round(a.xp*0.15));
      S.stun=a.stun;
      if(gains)gains.fails=(gains.fails||0)+1;else pushLog('Caught — stunned');
      return;
    }
    if(a.in&&!(CRAFT_SKILLS.includes(skill)&&diaryPerk('saveMats')&&Math.random()<0.10))
      for(const k in a.in)take(k,a.in[k]);
    if(a.out)for(const k in a.out){countMade(k,add(k,a.out[k]));noteItem(k,a.out[k]);}
    if(a.gp)gainGp(a.gp[0]+Math.floor(Math.random()*(a.gp[1]-a.gp[0]+1)));
    const gemMul=(skill==='mining'||skill==='thieving')&&diaryPerk('gems')?1.25:1;
    for(const d of rollLoot(gemMul>1?scaleRefs(a.loot,gemMul):a.loot)){add(d.id,d.qty);noteItem(d.id,d.qty);
      if(!gains)toast(`Found ${d.qty}× ${item(d.id).n}`);}
    grantXp(skill,a.xp);
    rollPet(skill,dur);
    rollTrail(a.lvl,dur);
    maybeEvent();
  }
}
function pushLog(t,k){
  if(gains)return;                       // never log during offline catch-up
  const d=new Date();
  const stamp=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');
  S.log.unshift({t,k:k||'hit',s:stamp});
  if(S.log.length>80)S.log.pop();
}
function resetSess(){S.sess={kills:0,gp:0,dealt:0,taken:0,eaten:0,deaths:0,swings:0,hits:0};}

function prayerBonus(){const p=lvl('prayer');return{hit:Math.floor(p/18),soak:Math.floor(p/12)};}
function allFoes(){return FOES.concat(BOSSES);}

function fightTick(dt,foe){
  if(!foe)return;
  if(S.foe!==foe.id){S.foe=foe.id;S.foeHp=foe.hp;S.prog=0;S.foeTimer=0;}
  S.prog+=dt;S.foeTimer+=dt;
  const G=gear(),P=prayerBonus();
  drinkIfNeeded();
  // Top up before swinging — walking into a fight at 10/90 hp should not be a death sentence.
  let guardEat=0;
  while(S.hp<maxHp()*0.5&&guardEat++<40){
    const before=S.hp;autoEat();
    if(S.hp===before)break;      // no food, or food that heals nothing
  }
  let st=style();
  let guard=0;
  while(S.prog>=G.spd&&guard++<600){
    S.prog-=G.spd;
    let ammo=null;
    if(ammoKind(st)){
      ammo=bestAmmo(st);
      if(!ammo){                                   // out of ammo — swing bare-handed
        if(!S.warnedAmmo){pushLog(`Out of ${ammoKind(st)}s — fighting unarmed`,'dead');S.warnedAmmo=1;}
        st='melee';
      }else{S.warnedAmmo=0;}
    }
    const match=foe.weak===st;
    const tri=match?.12:(foe.weak?-.06:0);
    const hitChance=Math.max(.25,Math.min(.95,.62+(styleLvl(st)-foe.lvl)*.012+buffTotal('acc')/100+(G.acc[st]||0)/100+tri));
    S.sess.swings++;
    if(ammo)spendAmmo(ammo);
    if(Math.random()<hitChance){
      const maxHit=maxHitFor(st,G,P,ammo)+(match?2:0);
      const roll=1+Math.floor(Math.random()*maxHit);
      const dmg=Math.min(roll,S.foeHp);           // overkill earns nothing
      S.foeHp-=dmg;
      S.sess.hits++;S.sess.dealt+=dmg;
      if(st==='melee'){grantXp('attack',Math.round(dmg*1.33));grantXp('strength',Math.round(dmg*1.33));}
      else grantXp(st,Math.round(dmg*2.66));
      grantXp('hitpoints',Math.round(dmg*0.45));
      pushLog(`${st==='melee'?'You hit':st==='ranged'?'Your arrow hits':'Your spell hits'} <b>${dmg}</b> on ${foe.n}${match?' <span class="weak">(weak to '+st+')</span>':''}${roll>dmg?' (overkill '+(roll-dmg)+')':''} — ${Math.max(0,S.foeHp)} hp left`,'hit');
      if(S.foeHp<=0){
        grantXp('defence',foe.xp);
        S.kills[foe.id]=(S.kills[foe.id]||0)+1;S.sess.kills++;
        const gp=gainGp(foe.gp[0]+Math.floor(Math.random()*(foe.gp[1]-foe.gp[0]+1)),true);
        S.sess.gp+=gp;
        const drops=[];
        for(const k in foe.drop){add(k,foe.drop[k]);noteItem(k,foe.drop[k]);drops.push(`${foe.drop[k]}× ${item(k).n}`);}
        // Table drops join the normal loot line rather than announcing
        // themselves — noteItem still books them into the offline summary.
        for(const d of rollLoot(foe.loot)){add(d.id,d.qty);noteItem(d.id,d.qty);
          drops.push(`${d.qty}× ${item(d.id).n}`);}
        pushLog(`${foe.n} dies — kill ${S.kills[foe.id]}, +${foe.xp} defence xp`,'kill');
        pushLog(`Loot: ${gp} gp${drops.length?', '+drops.join(', '):''}`,'loot');
        if(foe.delve){
          const d=DUNGEONS.find(x=>x.id===foe.id.split('#')[0]);
          S.delve.floor++;
          const deep=S.delve.floor-d.floors;
          // Descending past the clear is a deliberate choice, so offline
          // catch-up must not keep making it for you — it would push until
          // something killed you and the haul would go with it.
          if(gains&&deep>=0){
            if(deep===0){S.cleared[d.id]=(S.cleared[d.id]||0)+1;grantXp('slayer',d.bonusXp);gainGp(d.bonusGp,true);
              for(const u of rollLoot({id:d.ring,c:d.ringC})){add(u.id,u.qty);noteItem(u.id,u.qty);
                gains.uniques=(gains.uniques||0)+1;}
              gains.delves=(gains.delves||0)+1;}
            bankDelve('Left the dungeon');
            S.act=null;S.foe=null;S.foeHp=0;
            return;
          }
          if(deep===0){
            S.cleared[d.id]=(S.cleared[d.id]||0)+1;
            // The fixed clear pays out exactly as it always has. The run no
            // longer ends here — you choose whether to push on.
            grantXp('slayer',d.bonusXp);
            const bg=gainGp(d.bonusGp,true);
            for(const u of rollLoot({id:d.ring,c:d.ringC})){add(u.id,u.qty);noteItem(u.id,u.qty);
              pushLog(`${item(u.id).n} drops!`,'kill');
              if(gains)gains.uniques=(gains.uniques||0)+1;else{toast(`${item(u.id).n}!`);buzz('big');}}
            pushLog(`${d.n} cleared — ${fmt(d.bonusXp)} slayer xp, ${fmt(bg)} gp. Descend deeper, or leave to bank the haul.`,'task');
            if(gains)gains.delves=(gains.delves||0)+1;else toast(`${d.n} cleared`);
          }else if(deep>0){
            // Deep floors pay into a haul rather than the bank. Leaving keeps
            // it; dying loses the lot. Rising per floor, so depth compounds.
            S.delve.haulGp=(S.delve.haulGp||0)+Math.round(d.bonusGp*0.009*deep);
            S.delve.haulXp=(S.delve.haulXp||0)+Math.round(d.bonusXp*0.009*deep);
            if(deep>(S.deepest[d.id]||0)){
              S.deepest[d.id]=deep;
              pushLog(`New record — depth ${deep} in ${d.n}`,'task');
            }
            if(deep%5===0){
              for(const u of rollLoot({id:d.ring,c:d.ringC})){add(u.id,u.qty);noteItem(u.id,u.qty);
                pushLog(`${item(u.id).n} drops!`,'kill');
                if(gains)gains.uniques=(gains.uniques||0)+1;else{toast(`${item(u.id).n}!`);buzz('big');}}
            }
            pushLog(`Depth ${deep} — haul now ${fmt(S.delve.haulGp)} gp, ${fmt(S.delve.haulXp)} slayer xp`,'task');
          }else pushLog(`Descending to floor ${S.delve.floor+1} of ${d.floors}`,'task');
          return;
        }
        if(foe.boss){
          S.bossKills[foe.id]=(S.bossKills[foe.id]||0)+1;
          const uq=rollLoot(foe.unique);
          for(const u of uq){add(u.id,u.qty);noteItem(u.id,u.qty);
            pushLog(`${item(u.id).n} drops!`,'kill');
            if(gains)gains.uniques=(gains.uniques||0)+1;else{toast(`${item(u.id).n}!`);buzz('big');}}
          if(!uq.length)pushLog('No unique this time','miss');
          if(Math.random()<0.15)giveTrail(foe.lvl);
          S.act=null;S.foe=null;S.foeHp=0;
          if(!gains)toast(`${foe.n} defeated — spend another sigil to re-enter`);
          return;
        }
        if(S.task&&S.task.foe===foe.id&&S.task.done<S.task.need){
          S.task.done++;
          if(S.task.done>=S.task.need)finishTask();
          else pushLog(`Slayer task ${S.task.done} / ${S.task.need}`,'task');
        }
        S.foeHp=foe.hp;
        rollPet('combat',6000);
        rollTrail(foe.lvl,9000);
        maybeEvent();
      }
    }else{
      pushLog(`You miss ${foe.n}${(!match&&foe.weak)?' — it resists '+st:''}`,'miss');
    }
  }
  guard=0;
  while(S.foeTimer>=foe.spd&&guard++<600){
    S.foeTimer-=foe.spd;
    const raw=Math.floor(Math.random()*(foe.max+1));
    // Deep delve foes ignore a share of armour; everything else has pen 0.
    const blocked=Math.floor((Math.floor((G.def+buffTotal('def'))/8)+P.soak)*(1-(foe.pen||0)));
    let dmg=raw-blocked;
    if(dmg>0){
      S.hp-=dmg;S.sess.taken+=dmg;
      pushLog(`${foe.n} hits <b>${dmg}</b>${blocked>0?` (armour absorbed ${Math.min(blocked,raw)})`:''} — ${Math.max(0,S.hp)} hp left`,'hurt');
      // Order matters: a lethal blow kills outright. Eating must never revive you
      // from below zero, or food makes you immortal.
      if(S.hp<=0){
        const lost=Math.floor(S.gp*.15);S.gp-=lost;S.hp=maxHp();S.act=null;S.foe=null;
        S.sess.deaths++;
        if(S.delve){
          const h=S.delve.haulGp||0;
          pushLog(h?`Run ended at depth ${S.delve.floor-DUNGEONS.find(x=>x.id===S.delve.id).floors} — ${fmt(h)} gp haul lost`
                   :`Run ended on floor ${S.delve.floor+1} — completion bonus forfeit`,'dead');
          gains&&(gains.haulLost=(gains.haulLost||0)+(S.delve.haulGp||0));
          S.delve=null;
        }
        if(gains){gains.died=true;stopNote(`Died to ${foe.n}`);}else pushLog(`You died to ${foe.n}. Lost ${lost} gp.`,'dead');
        return;
      }
      if(S.hp<=maxHp()*.45)autoEat();
      // Retreat before a hit that COULD kill, not at a flat percentage — otherwise a
      // hard-hitting foe jumps straight over the safety net.
      const lethal=Math.max(1,foe.max-blocked);
      if(S.hp<=Math.max(maxHp()*.30,lethal)&&!Object.keys(S.bank).some(k=>I[k]&&I[k].heal&&S.bank[k]>0)){
        S.act=null;S.foe=null;
        pushLog('Out of food — retreated before dying','dead');
        if(gains){gains.retreated=true;stopNote(`Ran out of food fighting ${foe.n}`);}else toast('Retreated — no food left');
        bankDelve('Retreated');
        return;
      }
    }else if(raw>0){
      pushLog(`${foe.n} attacks — armour absorbs it`,'miss');
    }else{
      pushLog(`${foe.n} misses`,'miss');
    }
  }
}
function autoEat(){
  const foods=Object.keys(S.bank).filter(k=>I[k]&&I[k].heal);
  if(!foods.length)return;
  foods.sort((x,y)=>I[x].heal-I[y].heal);
  const need=maxHp()-S.hp;
  const pick=foods.find(f=>I[f].heal>=need)||foods[foods.length-1];
  const before=S.hp;
  const healed=Math.round(I[pick].heal*(1+room('kitchen')*0.25+diaryPerk('food')*0.10));
  take(pick,1);S.hp=Math.min(maxHp(),S.hp+healed);S.sess.eaten++;
  pushLog(`Ate ${I[pick].n} — healed ${S.hp-before} to ${S.hp} hp (${have(pick)} left)`,'eat');
}

/* ---- Slayer ---- */
function rollTask(){
  const cl=combatLvl();
  // Eligible by ceiling, then narrowed by a floor so combat 99 stops being
  // handed giant rats. If the floor empties the pool — high combat, no content
  // that high yet — fall back to the three hardest things that are eligible
  // rather than the whole list, which would put the rat back on the table.
  // Assumes FOES stays sorted by level; keep new entries in order.
  const elig=FOES.filter(f=>f.lvl<=cl+8);
  const banded=elig.filter(f=>f.lvl>=cl-25);
  const pool=banded.length?banded:elig.slice(-3);
  const foe=pool[Math.floor(Math.random()*pool.length)]||FOES[0];
  const need=8+Math.floor(Math.random()*18);
  S.task={foe:foe.id,need,done:0};
  return S.task;
}
function finishTask(){
  const foe=FOES.find(f=>f.id===S.task.foe);
  const pm=1+diaryPerk('slayerTask')*0.15;
  const bonus=Math.round(foe.xp*S.task.need*0.9*pm);
  const gp=Math.round(foe.gp[1]*S.task.need*0.6*pm);
  grantXp('slayer',bonus);gainGp(gp,true);
  S.tasksDone=(S.tasksDone||0)+1;
  if(gains)gains.tasks=(gains.tasks||0)+1;
  else{pushLog(`Task complete — ${S.task.need}× ${foe.n} for ${fmt(bonus)} slayer xp and ${fmt(gp)} gp`,'task');
    toast(`Task done — ${fmt(bonus)} slayer xp`);}
  if(Math.random()<.35){add('boss_sigil',1);noteItem('boss_sigil',1);
    if(!gains)pushLog('A boss sigil falls from the reward','loot');}
  S.task=null;
  rollTask();
}

/* ---- Collection log (9.1) ---- */
let CLOG_IDS=null;   // every log slot id, built on first use (CLOG reads tables from data.js)
function clogIds(){if(!CLOG_IDS)CLOG_IDS=new Set(CLOG.flatMap(g=>g.slots().map(x=>x.id)));return CLOG_IDS;}
function clogHas(id){return id.startsWith('pet:')?!!(S.pets&&S.pets[id.slice(4)]):!!(S.clog&&S.clog[id]);}
function logGot(id,n){
  if(!clogIds().has(id))return;
  if(!S.clog)S.clog={};
  const first=!S.clog[id];
  S.clog[id]=(S.clog[id]||0)+n;
  if(first)logNew(id);
}
function logNew(id){
  S.clogNew=(S.clogNew||[]).concat(id);
  const nm=id.startsWith('pet:')?PETS[id.slice(4)]:item(id).n;
  if(gains)gains.newLog=(gains.newLog||[]).concat(id);
  else{toast(`New collection log slot: ${nm}`);buzz();}
  clogRankCheck();
}
function clogCount(){let n=0;for(const id of clogIds())if(clogHas(id))n++;return{n,of:clogIds().size};}
/* Each rank is earned once and kept, and adds an hour to the offline cap. */
function clogRankCheck(){
  const{n,of}=clogCount();
  S.clogRank=S.clogRank||0;
  while(S.clogRank<CLOG_RANKS.length&&n>=Math.ceil(CLOG_RANKS[S.clogRank].at*of)){
    S.clogRank++;
    const nm=CLOG_RANKS[S.clogRank-1].n;
    if(!gains){toast(`Collection log: ${nm} rank — +1 hour offline`);buzz('big');}
  }
}
/* A save from before the log: credit what it can prove — anything banked or
   worn, anything ever made, capes held. Runs once, when S.clog is missing. */
function clogBackfill(){
  S.clog={};
  const worn=Object.values(S.equip||{});
  for(const id of clogIds()){
    if(id.startsWith('pet:'))continue;
    const n=(S.bank[id]||0)+((S.made||{})[id]||0)+(worn.includes(id)?1:0);
    if(n>0)S.clog[id]=n;
  }
  // fixed drops of anything killed, capes earned, and resources from well past a level
  for(const f of allFoes())if(((S.kills||{})[f.id]||(S.bossKills||{})[f.id])&&f.drop)
    for(const k in f.drop)if(clogIds().has(k)&&!S.clog[k])S.clog[k]=1;
  for(const k in (S.capes||{})){const id=k==='quests'?'wayfarer_cloak':k==='diary'?'diarist_cape':k==='raid'?'rampart_cape':k+'_cape';
    if(clogIds().has(id)&&!S.clog[id])S.clog[id]=1;}
  for(const sk of ['woodcutting','mining','fishing'])for(const a of SKILLS[sk].acts)
    if(a.out&&lvlFor((S.xp||{})[sk]||0)>=a.lvl+10){const k=Object.keys(a.out)[0];if(!S.clog[k])S.clog[k]=1;}
  S.clogNew=[];
  const r=S.clogRank;S.clogRank=0;gains={xp:{},items:{},capes:[]};clogRankCheck();gains=null;
  if(r>S.clogRank)S.clogRank=r;
}

/* ---- Errands (9.2) ----
   An errand is {k:'xp'|'make'|'kill', id, sk, n, base}. Progress is read from
   lifetime counters minus `base`, the counter when it was posted, so it moves
   offline with everything else and can never be undone. */
function errandCur(e){
  return e.k==='xp'?(S.xp[e.sk]||0):e.k==='kill'?((S.kills||{})[e.id]||0):((S.made||{})[e.id]||0);
}
function errandLeft(e){return Math.max(0,e.n-(errandCur(e)-e.base));}
function errandText(e){
  if(e.k==='xp')return `Gain ${fmt(e.n)} ${label(e.sk)} xp`;
  if(e.k==='kill')return `Defeat ${e.n}× ${(FOES.find(f=>f.id===e.id)||{n:e.id}).n}`;
  const gat=['woodcutting','mining','fishing','farming'].includes(e.sk);
  return `${gat?'Gather':'Make'} ${fmt(e.n)}× ${item(e.id).n}`;
}
/* What the player could do right now, as candidate errands. */
function errandPool(m){
  const out=[],mins=(m||ERRAND.mins)*60000;
  /* An action that uses materials only counts if the bank already holds
     enough for half the errand, so an errand never means a shopping trip. */
  const stocked=(a,per)=>!a.in||Object.keys(a.in).every(k=>have(k)>=a.in[k]*per/2);
  for(const sk in SKILLS){
    const L=lvl(sk);
    const acts=SKILLS[sk].acts.filter(a=>!a.sub&&a.lvl<=L);
    if(!acts.length)continue;
    const top=acts.slice(-3);
    for(const a of top){
      const per=Math.max(4,Math.round(mins/actDur(sk,a)));
      if(!stocked(a,per))continue;
      if(a.out){const id=Object.keys(a.out)[0];out.push({k:'make',sk,id,n:per*a.out[id]});}
      out.push({k:'xp',sk,n:Math.round(per*a.xp/50)*50||50});
    }
  }
  const cl=combatLvl(),food=Object.keys(S.bank).some(k=>I[k]&&I[k].heal);
  if(food){
    const G=gear(),P=prayerBonus(),st=style(),mh=maxHitFor(st,G,P,bestAmmo(st));
    for(const f of FOES.filter(f=>f.lvl<=cl+5).slice(-3)){
      const swings=f.hp/Math.max(1,(mh+1)/2*0.6);
      const per=Math.max(5,Math.min(60,Math.round(mins/(swings*G.spd))));
      out.push({k:'kill',id:f.id,sk:'slayer',n:per});
    }
  }
  return out;
}
function newErrand(avoid){
  // one errand per skill on the board, so it asks for variety
  let pool=errandPool().filter(c=>!avoid.some(e=>e.sk===c.sk));
  if(!pool.length)pool=errandPool().filter(c=>!avoid.some(e=>e.k===c.k&&e.id===c.id&&e.sk===c.sk));
  const c=pool[Math.floor(Math.random()*pool.length)];if(!c)return null;
  c.base=errandCur(c);c.uid=offerUid();
  return c;
}
/* Accrue one errand per 8 hours since the last, up to the cap, and keep the
   board filled from that stock. */
function errandTick(now){
  const E=S.errands;
  const every=86400000/ERRAND.perDay;
  if(!E.at)E.at=now;
  const n=Math.floor((now-E.at)/every);
  if(n>0){E.at+=n*every;E.stock=Math.min(ERRAND.cap-E.board.length,(E.stock||0)+n);}
  if(E.stock>ERRAND.cap-E.board.length)E.stock=ERRAND.cap-E.board.length;
  while(E.board.length<ERRAND.board&&E.stock>0){const e=newErrand(E.board);if(!e)break;E.board.push(e);E.stock--;}
  const W=S.well,wk=WELL.days*86400000;
  if(!W.at)W.at=now;
  const w=Math.floor((now-W.at)/wk);
  if(w>0){W.at+=w*wk;W.charges=Math.min(WELL.cap,(W.charges||0)+w);}
}
function errandsReady(){return S.errands.board.filter(e=>errandLeft(e)<=0).length;}
function handInErrand(uid){
  const E=S.errands,e=E.board.find(x=>x.uid===uid);
  if(!e||errandLeft(e)>0)return;
  const tl=ALL_SKILLS.reduce((n,k)=>n+lvl(k),0);
  const gp=gainGp(15*tl);
  S.marks=(S.marks||0)+ERRAND.marks;E.done=(E.done||0)+1;
  E.board=E.board.filter(x=>x!==e);
  errandTick(Date.now());
  toast(`Errand done — ${ERRAND.marks} marks, ${fmt(gp)} gp`);buzz();
}
function swapErrand(uid){
  const E=S.errands,i=E.board.findIndex(x=>x.uid===uid);if(i<0)return;
  const e=newErrand(E.board);if(!e){toast('Nothing else to offer right now');return;}
  E.board[i]=e;
}
/* The Wellspring: one charge a week, four held, poured into the lowest skill. */
function wellAmount(sk){const L=lvl(sk);return L>=99?0:Math.max(1000,Math.round(0.6*(XP[L]-XP[L-1])));}
function lowestSkill(){return ALL_SKILLS.filter(k=>lvl(k)<99).sort((a,b)=>(S.xp[a]||0)-(S.xp[b]||0))[0]||null;}
function useWell(){
  const W=S.well,sk=lowestSkill();if(!W.charges||!sk)return;
  const n=wellAmount(sk);W.charges--;grantXp(sk,n);
  toast(`The Wellspring pours ${fmt(n)} xp into ${label(sk)}`);buzz();
}
/* Guild shop. Each buy returns true if it happened. */
function bestSeed(){const c=CROPS.filter(c=>c.lvl<=lvl('farming'));return c.length?c[c.length-1].seed:null;}
function bestFood(){const a=SKILLS.cooking.acts.filter(a=>!a.sub&&a.lvl<=lvl('cooking')&&a.out);return a.length?Object.keys(a[a.length-1].out)[0]:'minnow';}
function guildBuy(id,sk){
  const g=GUILD.find(x=>x.id===id);if(!g)return false;
  if((S.marks||0)<g.cost){toast('Not enough marks');return false;}
  if(g.max&&((S.guild||{})[id]||0)>=g.max){toast('Already bought');return false;}
  let ok=true;
  if(id==='sigil')ok=!!add('boss_sigil',1,true);
  else if(id==='seeds')ok=!!add(bestSeed(),4,true);
  else if(id==='food')ok=!!add(bestFood(),30,true);
  else if(id==='trail')ok=typeof giveTrail==='function'&&giveTrail(null);
  else if(id==='tome'){if(!sk||lvl(sk)>=99)return false;const L=lvl(sk);grantXp(sk,Math.round((XP[L]-XP[L-1])*0.5));}
  if(!ok){toast('No free bank slot');return false;}
  S.marks-=g.cost;S.guild=S.guild||{};S.guild[id]=(S.guild[id]||0)+1;
  toast(`Bought ${g.n}`);return true;
}

/* ---- Treasure trails (9.3) ----
   S.trails[tier] is absent, {sealed:1}, {steps:[...],i} under way, or
   {casket:1} waiting to be opened. */
function trailTierFor(L){let t=TRAILS[0];for(const x of TRAILS)if(L>=x.lvl)t=x;return t;}
function giveTrail(L){
  if(L===null){   // the Guild shop: the highest free tier the player has reached
    const cl=Math.max(combatLvl(),...Object.keys(SKILLS).map(k=>lvl(k)));
    const t=TRAILS.filter(x=>x.lvl<=cl&&!S.trails[x.id]).pop();
    if(!t){toast('You already hold a trail of every tier you can reach');return false;}
    S.trails[t.id]={sealed:1};return true;
  }
  const t=trailTierFor(L);if(S.trails[t.id])return false;
  S.trails[t.id]={sealed:1};
  if(gains)gains.trails=(gains.trails||0)+1;
  else{pushLog(`A sealed ${t.n.toLowerCase()} trail turns up`,'loot');toast(`Sealed ${t.n.toLowerCase()} trail found`);buzz();}
  return true;
}
function rollTrail(L,dur){if(Math.random()<dur/TRAIL_DENOM)giveTrail(L);}
function openTrail(id){
  const t=TRAILS.find(x=>x.id===id),T=S.trails[id];if(!t||!T||!T.sealed)return;
  const steps=[];
  for(let i=0;i<t.steps;i++){
    let pool=errandPool(t.mins).filter(c=>!steps.some(e=>e.sk===c.sk));
    if(!pool.length)pool=errandPool(t.mins);
    const c=pool[Math.floor(Math.random()*pool.length)];if(c){c.uid=offerUid();steps.push(c);}
  }
  if(!steps.length){toast('Nothing to follow yet — train a little first');return;}
  steps[0].base=errandCur(steps[0]);
  S.trails[id]={steps,i:0};
}
/* Advances any trail whose current step is done. Runs in the loop and offline. */
function trailTick(){
  for(const t of TRAILS){
    const T=S.trails[t.id];if(!T||!T.steps)continue;
    let g=0;
    while(errandLeft(T.steps[T.i])<=0&&g++<10){
      T.i++;
      if(T.i>=T.steps.length){S.trails[t.id]={casket:1};
        if(!gains){toast(`${t.n} trail complete — a casket awaits`);buzz();}break;}
      T.steps[T.i].base=errandCur(T.steps[T.i]);
    }
  }
}
function casketsReady(){return TRAILS.some(t=>S.trails[t.id]&&(S.trails[t.id].casket||S.trails[t.id].sealed));}
function openCasket(id){
  const t=TRAILS.find(x=>x.id===id),T=S.trails[id];if(!t||!T||!T.casket)return;
  const got=[];
  const gp=gainGp(t.gp[0]+Math.floor(Math.random()*(t.gp[1]-t.gp[0]+1)));
  const mats={};
  for(let i=0;i<t.rolls;i++){const m=t.mats[Math.floor(Math.random()*t.mats.length)];
    mats[m]=(mats[m]||0)+Math.max(1,Math.round((t.gp[0]/item(m).v)*(0.4+Math.random()*0.6)));}
  for(const m in mats)if(add(m,mats[m]))got.push(`${mats[m]}× ${item(m).n}`);
  let rare=null;
  if(Math.random()<t.uq){rare=t.uniques[Math.floor(Math.random()*t.uniques.length)];if(add(rare,1))got.unshift(item(rare).n);}
  S.marks=(S.marks||0)+t.marks;
  S.trailsDone=S.trailsDone||{};S.trailsDone[id]=(S.trailsDone[id]||0)+1;
  delete S.trails[id];
  pushLog(`${t.n} casket: ${fmt(gp)} gp, ${t.marks} marks${got.length?', '+got.join(', '):''}`,'loot');
  lastCasket={tier:t.n,gp,marks:t.marks,got,rare};
  toast(rare?`${item(rare).n}!`:`${t.n} casket opened — ${fmt(gp)} gp`);buzz(rare?'big':'tick');
}
let lastCasket=null;

/* ---- Requirements ---- */
/* One requirement engine, shared by quests and (from 7.0) the achievement diary.
   A requirement is an object of check types, e.g. {lvl:{mining:20},items:{iron_ore:30}},
   and every check listed must pass. Each type says how to read its current value
   and what to call itself, so a single definition drives both whether it is met
   and the progress text on screen.
   meets() and reqParts() read the state they are handed rather than S, per the
   PVP-foundation rule: a requirement should be checkable against any player.
   Types are checked and listed in the order below, so a requirement always reads
   the same way on screen. Progress caps at the target; a type with fmt words
   itself instead of showing a count. */
const REQ_TYPES={
  lvl:    {cur:(st,k)=>lvlFor((st.xp||{})[k]||0),       name:k=>label(k)},
  kills:  {cur:(st,k)=>(st.kills||{})[k]||0,             name:k=>(allFoes().find(f=>f.id===k)||{n:k}).n},
  items:  {cur:(st,k)=>(st.bank||{})[k]||0,              name:k=>item(k).n, handIn:true},   // consumed on claim
  total:  {cur:st=>ALL_SKILLS.reduce((n,k)=>n+lvlFor((st.xp||{})[k]||0),0), name:()=>'Total level', single:true},
  bosses: {cur:(st,k)=>(st.bossKills||{})[k]||0,         name:k=>'Defeat '+(BOSSES.find(b=>b.id===k)||{n:k}).n},
  cleared:{cur:(st,k)=>(st.cleared||{})[k]||0,           name:k=>'Clear '+(DUNGEONS.find(d=>d.id===k)||{n:k}).n},
  depth:  {cur:(st,k)=>(st.deepest||{})[k]||0,           name:k=>(DUNGEONS.find(d=>d.id===k)||{n:k}).n+' depth'},
  quests: {cur:(st,k)=>(st.quests||{})[k]?1:0,           name:k=>(QUESTS.find(q=>q.id===k)||{n:k}).n,
           fmt:(nm,c)=>c?'✓ '+nm:'After '+nm},
  have:   {cur:(st,k)=>(st.bank||{})[k]||0,              name:k=>'Own '+item(k).n},         // held, never consumed
  made:   {cur:(st,k)=>(st.made||{})[k]||0,              name:k=>item(k).n+' made'},
  tool:   {cur:(st,k)=>(st.tools||{})[k]||0,             name:k=>k,                         // tier index, owned not held
           fmt:(k,c,need)=>(c>=need?'✓ ':'')+'Own '+TOOLS[k][need].n},
  tasks:  {cur:st=>st.tasksDone||0,                      name:()=>'Slayer tasks', single:true},
};
function reqEntries(req){
  const out=[];if(!req)return out;
  for(const t in REQ_TYPES){
    if(req[t]===undefined)continue;
    const T=REQ_TYPES[t];
    if(T.single)out.push({T,k:null,need:req[t]});
    else for(const k in req[t])out.push({T,k,need:req[t][k]});
  }
  return out;
}
function meets(req,st){return reqEntries(req).every(e=>e.T.cur(st,e.k)>=e.need);}
function reqParts(req,st){
  return reqEntries(req).map(e=>{const c=e.T.cur(st,e.k),nm=e.T.name(e.k);
    return e.T.fmt?e.T.fmt(nm,c,e.need):`${nm} ${Math.min(c,e.need)}/${e.need}`;});
}
// Claiming is a local action on the player's own save, so this one does use S.
function handIn(req){for(const e of reqEntries(req))if(e.T.handIn)take(e.k,e.need);}
function countMade(id,n){if(n>0){S.made=S.made||{};S.made[id]=(S.made[id]||0)+n;}}

/* ---- Quests ---- */
function questState(q){
  if(S.quests[q.id])return'done';
  return meets(q.need,S)?'ready':'locked';
}
function claimQuest(q){
  if(questState(q)!=='ready')return;
  handIn(q.need);
  if(q.reward.xp)for(const k in q.reward.xp)grantXp(k,q.reward.xp[k]);
  if(q.reward.items)for(const k in q.reward.items)add(k,q.reward.items[k]);
  if(q.reward.gp)S.gp+=q.reward.gp;
  S.quests[q.id]=1;
  toast(`Quest complete — ${q.n}`);buzz();
  awardCloak();
}
/* Awarded when the last quest is claimed, once. If the bank has no free slot
   at that moment the flag is not set, and the Quests tab offers the cloak again
   rather than losing it. */
function awardCloak(){
  if(S.capes.quests||!QUESTS.every(x=>S.quests[x.id]))return false;
  if(!add('wayfarer_cloak',1)){toast("Free a bank slot to receive the Wayfarer's cloak");return false;}
  S.capes.quests=1;toast("Every quest complete — Wayfarer's cloak earned");
  return true;
}
function questsReady(){return QUESTS.some(q=>questState(q)==='ready');}

/* ---- Achievement diary ---- */
const diaryKey=(d,i)=>d.id+i;
// 1 if the tier carrying this perk is claimed. Every perk sits on exactly one tier.
function diaryPerk(p){
  if(!S.diary)return 0;
  for(const d of DIARY)for(let i=0;i<d.tiers.length;i++)
    if(d.tiers[i].perk===p)return S.diary[diaryKey(d,i)]?1:0;
  return 0;
}
function tierState(d,i){
  if(S.diary[diaryKey(d,i)])return'done';
  return d.tiers[i].tasks.every(t=>meets(t,S))?'ready':'locked';
}
function claimTier(d,i){
  if(tierState(d,i)!=='ready')return;
  S.diary[diaryKey(d,i)]=1;
  if(d.tiers[i].perk==='patch')while(S.farm.length<totalPatches())S.farm.push({crop:null,ms:0});
  toast(`${d.n} ${DIARY_TIERS[i]} complete — ${d.tiers[i].desc}`);buzz();
  awardDiaryCape();
}
// Same rules as the Wayfarer's cloak: no free slot means not yet, never lost.
function awardDiaryCape(){
  if(S.capes.diary||!DIARY.every(d=>d.tiers.every((t,i)=>S.diary[diaryKey(d,i)])))return false;
  if(!add('diarist_cape',1)){toast("Free a bank slot to receive the Diarist's cape");return false;}
  S.capes.diary=1;toast("Every diary complete — Diarist's cape earned");
  return true;
}
function diaryReady(){return DIARY.some(d=>d.tiers.some((t,i)=>tierState(d,i)==='ready'));}

/* ============================================================
   CASTLE DEFENCE
   The raid itself is pure: raidNew / raidStep / raidMove / raidOil read and
   write only the raid object and the combatant they are handed, and draw
   randomness from the raid's own seeded generator. Nothing in them touches S,
   so a raid can be replayed from its seed and inputs. The wrapper below
   (startRaid / raidTick / endRaid) is the only part that reads or pays into S.
   ============================================================ */
// mulberry32: a small seeded generator whose whole state is one integer.
function rngNext(o){
  o.rs=(o.rs+0x6D2B79F5)|0;let t=o.rs;
  t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
  return((t^(t>>>14))>>>0)/4294967296;
}
function raidNew(L,seed,rooms){
  const r={lvl:L,seed,rs:seed|0,t:0,wave:0,waveT:-RAID.waveGap,spawned:0,
    lanes:RAID.lanes.map(l=>({id:l.id,wall:RAID.wallHp(rooms.walls||0),wallMax:RAID.wallHp(rooms.walls||0),q:[],defT:0})),
    barracks:rooms.barracks||0,oilMax:RAID.oilMs(rooms.kitchen||0),oil:0,
    at:1,moving:0,swing:0,kills:0,over:null,nid:0};
  return r;
}
function raidFront(lane){              // the raider nearest the wall
  let f=null;for(const x of lane.q)if(!f||x.walk<f.walk)f=x;return f;
}
function raidKill(r,lane,x,ev,by){
  lane.q=lane.q.filter(y=>y!==x);r.kills++;
  ev.push({t:'kill',xp:by==='you'?RAID.raider(r.lvl).xp:0,lane:lane.id,by});
}
function raidMove(r,i){if(!r.over&&i!==r.at&&RAID.lanes[i]){r.at=i;r.moving=RAID.moveMs;r.swing=0;}}
function raidOil(r,i,ev){
  const lane=r.lanes[i];if(r.over||r.oil>0||!lane)return false;
  const x=raidFront(lane);if(!x)return false;
  r.oil=r.oilMax;raidKill(r,lane,x,ev||[],'oil');return true;
}
/* Who you swing at: your own lane's front raider. A ranged player whose lane
   is clear shoots a raider battering a neighbouring wall instead (the weaker
   wall first), at reduced accuracy (RAID.perk.farAcc). */
function raidTarget(r,me){
  const lane=r.lanes[r.at],x=raidFront(lane);
  if(x||me.st!=='ranged')return x?{lane,x}:null;
  let best=null;
  for(const i of [r.at-1,r.at+1]){
    const l=r.lanes[i],y=l&&raidFront(l);
    if(y&&y.walk<=0&&(!best||l.wall<best.lane.wall))best={lane:l,x:y};
  }
  return best;
}
/* me: {hp, st, lvl, acc, maxHit, spd, soak}. Returns the events of this step. */
function raidStep(r,me,dt){
  const ev=[];
  while(dt>0&&!r.over){const d=Math.min(100,dt);dt-=d;raidSlice(r,me,d,ev);}
  return ev;
}
function raidSlice(r,me,d,ev){
  const R=RAID.raider(r.lvl),count=RAID.waves[r.wave];
  r.t+=d;r.waveT+=d;r.oil=Math.max(0,r.oil-d);
  // spawn
  while(r.spawned<count&&r.waveT>=r.spawned*RAID.spawnGap(r.lvl)){
    const lane=r.lanes[Math.floor(rngNext(r)*r.lanes.length)];
    lane.q.push({id:++r.nid,hp:R.hp,walk:RAID.walk,atk:0});r.spawned++;
  }
  // raiders march, then strike the wall — or you, if you hold that lane
  for(let i=0;i<r.lanes.length;i++){
    const lane=r.lanes[i],held=r.at===i&&r.moving<=0;
    for(const x of lane.q){
      if(x.walk>0){x.walk=Math.max(0,x.walk-d);continue;}
      x.atk+=d;
      while(x.atk>=R.spd){
        x.atk-=R.spd;
        if(held){
          const dmg=Math.max(0,Math.floor(rngNext(r)*(R.max+1))-me.soak);
          if(dmg>0){me.hp-=dmg;ev.push({t:'hurt',dmg,lane:lane.id});}
          if(me.hp<=0){r.over={won:false,why:'downed'};ev.push({t:'end',won:false,why:'downed'});return;}
        }else{
          lane.wall=Math.max(0,lane.wall-R.wall);
          if(lane.wall<=0){r.over={won:false,why:'breached',lane:lane.id};ev.push({t:'end',won:false,why:'breached',lane:lane.id});return;}
        }
      }
    }
    // barracks defender
    if(r.barracks>0){
      lane.defT+=d;
      while(lane.defT>=RAID.defMs){
        lane.defT-=RAID.defMs;
        const x=raidFront(lane);if(!x)continue;
        x.hp-=Math.max(1,Math.round(R.hp*r.barracks*0.03));
        if(x.hp<=0)raidKill(r,lane,x,ev,'defender');
      }
    }
  }
  // you
  if(r.moving>0){r.moving=Math.max(0,r.moving-d);}
  else{
    const lane=r.lanes[r.at];
    // Melee: a fighter on the wall shores it up while holding it.
    if(me.st==='melee'&&RAID.perk.mend){r.mend=(r.mend||0)+d*RAID.perk.mend/1000;
      const m=Math.floor(r.mend);if(m>0){r.mend-=m;lane.wall=Math.min(lane.wallMax,lane.wall+m);}}
    r.swing+=d;
    let guard=0;
    while(r.swing>=me.spd&&guard++<20){
      const tg=raidTarget(r,me);
      if(!tg){r.swing=me.spd;r.aim=null;break;}   // ready to swing the moment one appears
      const {lane:tl,x}=tg;
      r.swing-=me.spd;
      ev.push({t:'shot'});
      r.aim=tl===lane?null:tl.id;
      const hit=Math.max(.25,Math.min(.95,.62+(me.lvl-R.lvl)*.012+me.acc))*(tl===lane?1:RAID.perk.farAcc);
      if(rngNext(r)<hit){
        const roll=1+Math.floor(rngNext(r)*me.maxHit);
        let dmg=Math.min(x.hp,roll);const left=roll-dmg;
        x.hp-=dmg;
        // Magic: the blast scorches every other raider in your lane.
        if(me.st==='magic')for(const y of tl.q.slice())if(y!==x){
          const s=Math.min(y.hp,Math.max(1,Math.floor(roll*RAID.perk.splash)));
          y.hp-=s;dmg+=s;if(y.hp<=0)raidKill(r,tl,y,ev,'you');
        }
        // Melee: what is left of a killing blow carries into the next raider.
        if(x.hp<=0){
          raidKill(r,tl,x,ev,'you');
          if(me.st==='melee'){
            const y=raidFront(tl),c=y?Math.min(y.hp,Math.floor(left*RAID.perk.cleave)):0;
            if(c>0){y.hp-=c;dmg+=c;if(y.hp<=0)raidKill(r,tl,y,ev,'you');}
          }
        }
        ev.push({t:'hit',dmg});
      }else ev.push({t:'miss'});
    }
  }
  // wave over?
  if(r.spawned>=count&&r.lanes.every(l=>!l.q.length)){
    ev.push({t:'wave',w:r.wave+1});
    r.wave++;
    if(r.wave>=RAID.waves.length){r.over={won:true};ev.push({t:'end',won:true});return;}
    r.waveT=-RAID.waveGap;r.spawned=0;
  }
}

/* ---- the wrapper: the only raid code that reads S ---- */
let raid=null,lastRaid=null;
function combatant(){
  const G=gear(),P=prayerBonus();
  let st=style(),ammo=null;
  if(ammoKind(st)){ammo=bestAmmo(st);if(!ammo)st='melee';}
  return{hp:S.hp,st,ammo,lvl:styleLvl(st),acc:(buffTotal('acc')+(G.acc[st]||0))/100,maxHit:maxHitFor(st,G,P,ammo),
    spd:G.spd,soak:Math.floor((G.def+buffTotal('def'))/8)+P.soak};
}
function raidMaxLvl(){return Math.min(RAID.maxLvl,(S.ramparts.best||0)+1);}
function startRaid(L){
  if(raid||L<1||L>raidMaxLvl())return false;
  if(S.delve)bankDelve('Left the dungeon');
  S.act=null;S.foe=null;S.foeHp=0;S.prog=0;
  raid=raidNew(L,(Math.random()*4294967296)|0,{walls:room('walls'),barracks:room('barracks'),kitchen:room('kitchen')});
  raid.gp=0;raid.taken=0;
  S.ramparts.runs++;
  pushLog(`Raid level ${L} — raiders sighted`,'task');
  return true;
}
function raidTick(dt){
  drinkIfNeeded();
  let g=0;
  while(S.hp<maxHp()*0.5&&g++<40){const b=S.hp;autoEat();if(S.hp===b)break;}
  const me=combatant();
  const ev=raidStep(raid,me,dt);
  S.hp=Math.max(0,me.hp);
  for(const e of ev){
    if(e.t==='shot'){if(me.ammo)spendAmmo(me.ammo);}
    else if(e.t==='hit'){
      if(me.st==='melee'){grantXp('attack',Math.round(e.dmg*1.33));grantXp('strength',Math.round(e.dmg*1.33));}
      else grantXp(me.st,Math.round(e.dmg*2.66));
      grantXp('hitpoints',Math.round(e.dmg*0.45));
    }
    else if(e.t==='hurt')raid.taken+=e.dmg;
    else if(e.t==='kill'&&e.xp)grantXp('defence',e.xp);
    else if(e.t==='wave'){
      const gp=gainGp(RAID.gp(raid.lvl)*e.w,true);raid.gp+=gp;
      pushLog(`Wave ${e.w} of ${RAID.waves.length} held — ${fmt(gp)} gp`,'kill');
    }
    else if(e.t==='end'){endRaid(e);return;}
  }
}
function raidPlayerOil(i){
  if(!raid)return;
  const ev=[];
  if(raidOil(raid,i,ev))pushLog(`Burning oil poured on the ${RAID.lanes[i].n}`,'hit');
}
/* e: {won} or {won:false, why:'downed'|'breached'|'left', lane}. Waves already
   held were paid as they fell, so a loss costs time, never items. */
function endRaid(e){
  const r=raid;raid=null;if(!r)return;
  const L=r.lvl,res={lvl:L,won:!!e.won,why:e.why,waves:r.wave,gp:r.gp,kills:r.kills,items:[]};
  if(e.won){
    S.ramparts.clears++;
    if(L>(S.ramparts.best||0))S.ramparts.best=L;
    const c=RAID.chest(L);
    for(const k in c){const n=add(k,c[k]);if(n)res.items.push(`${c[k]}× ${item(k).n}`);}
    rollPet('raid',28000*L);   // about 1 in 150 per level 10 clear
  }
  if(e.why==='downed'){S.hp=maxHp();}
  lastRaid=res;
  if(e.won){pushLog(`Raid level ${L} repelled${res.items.length?' — chest: '+res.items.join(', '):''}`,'kill');toast(`Raid level ${L} repelled`);buzz();}
  else if(e.why==='breached'){const ln=RAID.lanes.find(l=>l.id===e.lane);pushLog(`The ${ln?ln.n:'wall'} fell — raid over after ${r.wave} wave${r.wave===1?'':'s'}`,'dead');toast('The castle was breached');}
  else if(e.why==='downed'){pushLog(`You were overrun — raid over after ${r.wave} wave${r.wave===1?'':'s'}`,'dead');toast('Overrun — raid lost');}
  else pushLog(`Left the raid after ${r.wave} wave${r.wave===1?'':'s'}`,'task');
  awardRampartCape();
  raidEnded=true;
}
let raidEnded=false;
// Same rules as the Wayfarer's cloak: no free slot means not yet, never lost.
function awardRampartCape(){
  if(S.capes.raid||(S.ramparts.best||0)<RAID.maxLvl)return false;
  if(!add('rampart_cape',1)){toast('Free a bank slot to receive the Rampart cape');return false;}
  S.capes.raid=1;toast('Level 10 raid repelled — Rampart cape earned');
  return true;
}

/* ============================================================
   OFFLINE
   ============================================================ */
const OFFLINE_CAP=12*3600*1000;
function offlineCap(){return OFFLINE_CAP+diaryPerk('offline')*4*3600*1000+(S.clogRank||0)*3600*1000;}
function stopNote(msg){if(gains&&!gains.stop)gains.stop={msg,at:gains.t||0};}
function catchUp(){
  const now=Date.now();
  const away=now-(S.last||now);
  let elapsed=Math.min(away,offlineCap());
  S.last=now;
  if(elapsed<20000)return null;
  const ripeBefore=S.farm.filter(p=>p.crop&&p.ms<=0).length;
  const actBefore=S.act;
  gains={xp:{},items:{},gp:0,died:false,events:0,fails:0,tasks:0,capes:[],ms:elapsed,away,t:0};
  const step=250;let guard=0;
  while(elapsed>0&&S.act&&guard++<300000){const d=Math.min(step,elapsed);tick(d);elapsed-=d;gains.t+=d;if(guard%240===0)trailTick();}
  if(actBefore&&!S.act)stopNote(actBefore.startsWith('fight:')&&BOSSES.some(b=>'fight:'+b.id===actBefore)?'Boss defeated — the fight ended':'Your activity ended');
  // crops and potion timers keep running even with no skill set, or after one stops
  if(elapsed>0){farmTick(elapsed);buffTick(elapsed);geTick(elapsed);}
  gains.ripened=S.farm.filter(p=>p.crop&&p.ms<=0).length-ripeBefore;
  errandTick(now);trailTick();gains.errands=errandsReady();
  const out=gains;gains=null;return out;
}
const durTxt=ms=>{const h=ms/3600000;if(h>=1)return h.toFixed(1)+' hours';const m=Math.max(1,Math.round(ms/60000));return m+(m===1?' minute':' minutes');};
/* The return screen leads with what feels best: levels, then the rare things,
   then the bulk, then why it stopped. It ends on what to do next. */
function showCatchUp(r){
  if(!r)return;
  const li=[];
  li.push(`<li>Away ${durTxt(r.away)}${r.away>r.ms+60000?` <span class="dim">(progress counts the first ${durTxt(r.ms)})</span>`:''}</li>`);
  for(const k in (r.lvls||{})){const[a,b]=r.lvls[k];li.push(`<li class="big">${label(k)} level ${b}${b-a>1?` <span class="dim">(+${b-a})</span>`:''}</li>`);}
  for(const c of r.capes)li.push(`<li class="big">${label(c)} 99 — cape earned</li>`);
  for(const pn of (r.pets||[]))li.push(`<li class="big">Pet found: ${pn}</li>`);
  if(r.uniques)li.push(`<li class="big">${r.uniques} rare drop${r.uniques>1?'s':''}</li>`);
  for(const id of (r.newLog||[]))li.push(`<li class="big">New collection log slot: ${item(id).n}</li>`);
  if(r.trails)li.push(`<li class="big">A sealed trail turned up</li>`);
  for(const k in r.xp)if(r.xp[k]>0)li.push(`<li>${label(k)} +${fmt(Math.round(r.xp[k]))} xp</li>`);
  for(const k in r.items)li.push(`<li>${item(k).n} ×${fmt(r.items[k])}</li>`);
  if(r.gp)li.push(`<li>${fmt(r.gp)} gp</li>`);
  if(r.tasks)li.push(`<li>${r.tasks} slayer task${r.tasks>1?'s':''} finished</li>`);
  if(r.errands)li.push(`<li>${r.errands} errand${r.errands>1?'s':''} ready to hand in</li>`);
  if(r.ripened>0)li.push(`<li>${r.ripened} crop${r.ripened>1?'s':''} ready to harvest</li>`);
  if(r.trades)li.push(`<li>${r.trades} market offer${r.trades>1?'s':''} completed</li>`);
  if(r.haulGp)li.push(`<li>Left a dungeon with ${fmt(r.haulGp)} gp of haul banked</li>`);
  if(r.haulLost)li.push(`<li><b>Died deep — ${fmt(r.haulLost)} gp of dungeon haul lost</b></li>`);
  if(r.delves)li.push(`<li>${r.delves} dungeon${r.delves>1?'s':''} cleared</li>`);
  if(r.events)li.push(`<li>${r.events} chance encounter${r.events>1?'s':''}</li>`);
  if(r.stop)li.push(`<li class="warn">${r.stop.msg} after ${durTxt(r.stop.at)}</li>`);
  if(li.length<2)return;
  const g=nextGoals(1)[0];
  if(g)li.push(`<li class="goal">Next: ${g.title} <span class="dim">— ${g.sub}</span></li>`);
  // Asked once, in context: right after a long absence, never on first launch.
  if(native()&&!S.notify.asked&&!S.notify.on&&r.away>3600000)
    li.push(`<li class="goal">Want a nudge when an activity runs out or your crops are ready? At most two a day, never at night.
      <button class="mini buy" data-notifyask="yes" style="margin-top:8px">Turn on</button> <button class="mini" data-notifyask="no" style="margin-top:8px">No thanks</button></li>`);
  document.getElementById('wblist').innerHTML=li.join('');
  document.getElementById('wb').classList.add('show');
  if((r.lvls&&Object.keys(r.lvls).length)||(r.pets||[]).length||r.uniques)buzz();
}

/* ============================================================
   NOTIFICATIONS (9.4)
   Only in the Android app, only when switched on, and only for things the
   player set going: an activity running out of materials, every crop ripe,
   the offline cap reached. Two at most, merged when close together, never
   between 22:00 and 08:00, and all cancelled the moment the game is back.
   ============================================================ */
const NOTE_KINDS=[['stop','An activity runs out of materials'],['farm','Every crop is ready'],['cap','Offline progress is full']];
function native(){return (typeof window!=='undefined'&&window.HollowNative)||null;}
function planNotices(now){
  const out=[],N=S.notify;
  const cur=findAct(S.act);
  if(N.stop&&cur&&cur.a&&cur.a.in){
    let batches=Infinity;for(const k in cur.a.in)batches=Math.min(batches,Math.floor(have(k)/cur.a.in[k]));
    const ms=batches*actDur(cur.skill,cur.a)-(S.prog||0);
    if(ms>0&&ms<offlineCap())out.push({at:ms,t:'Out of materials',b:`${cur.a.n} has used up its materials.`});
  }
  if(N.cap&&S.act&&!out.length)out.push({at:offlineCap(),t:`${Math.round(offlineCap()/3600000)} hours of work done`,b:'Progress pauses until you come back.'});
  if(N.farm){
    const g=S.farm.filter((p,i)=>i<totalPatches()&&p.crop&&p.ms>0);
    if(g.length)out.push({at:Math.max(...g.map(p=>p.ms)),t:'Crops are ready',b:`${S.farm.filter((p,i)=>i<totalPatches()&&p.crop).length} patches ready to harvest.`});
  }
  out.sort((a,b)=>a.at-b.at);
  // merge anything within half an hour of the one before
  const merged=[];
  for(const n of out){const p=merged[merged.length-1];
    if(p&&n.at-p.at<1800000){p.at=n.at;p.t=p.t+' · '+n.t;p.b=p.b+' '+n.b;}else merged.push(Object.assign({},n));}
  // quiet hours: 22:00-08:00 moves to 08:00
  for(const n of merged){const d=new Date(now+n.at),h=d.getHours();
    if(h>=22||h<8){if(h>=22)d.setDate(d.getDate()+1);d.setHours(8,0,0,0);n.at=d.getTime()-now;}}
  return merged.slice(0,2);
}
function scheduleNotices(){
  const nb=native();if(!nb)return;
  try{nb.cancelAll();
    if(!S.notify.on||!nb.canNotify())return;
    planNotices(Date.now()).forEach((n,i)=>nb.schedule(i+1,Math.max(60,Math.round(n.at/1000)),'Hollowmere — '+n.t,n.b));
  }catch(e){}
}
function clearNotices(){const nb=native();if(nb)try{nb.cancelAll();}catch(e){}}

/* ============================================================
   NEXT GOALS (9.0)
   The nearest few things the player could reach, from content that already
   exists: the next action in each skill, diary tiers, quests, castle rooms,
   bosses and dungeons. Ranked by how far along they are. One can be pinned;
   it stays first and announces itself when reached.
   ============================================================ */
function reqProgress(req,st){
  const es=reqEntries(req);if(!es.length)return 1;
  let t=0;for(const e of es)t+=Math.min(1,e.T.cur(st,e.k)/(e.need||1));
  return t/es.length;
}
function allGoals(){
  const out=[];
  // the next unlock in every trainable skill, and combat unlocks
  for(const sk in SKILLS){
    const L=lvl(sk),a=SKILLS[sk].acts.find(x=>!x.sub&&x.lvl>L);
    if(!a)continue;
    const xp=S.xp[sk]||0,need=XP[a.lvl-1];
    out.push({key:'skill:'+sk+':'+a.id,kind:'skill',sk,title:`${label(sk)} ${a.lvl} — ${a.n}`,
      sub:`${fmt(need-xp)} xp to go`,p:xp/need,done:L>=a.lvl});
  }
  const cl=combatLvl();
  for(const b of BOSSES.concat(DUNGEONS)){
    if(cl>=b.req)continue;
    if(b.req-cl>10)break;   // only once it is in sight
    out.push({key:'combat:'+b.id,kind:'combat',title:`Combat ${b.req} — ${b.n}`,sub:`you are combat ${cl}`,p:cl/b.req});
    break;   // only the next one
  }
  for(const d of DIARY)d.tiers.forEach((t,i)=>{
    if(S.diary[diaryKey(d,i)])return;
    const met=t.tasks.filter(x=>meets(x,S)).length;
    const p=t.tasks.reduce((n,x)=>n+reqProgress(x,S),0)/t.tasks.length;
    out.push({key:'diary:'+d.id+':'+i,kind:'diary',title:`${d.n} diary, ${DIARY_TIERS[i]}`,
      sub:met===t.tasks.length?'ready to claim':`${met} of ${t.tasks.length} tasks · ${t.desc}`,p});
  });
  for(const q of QUESTS){
    if(S.quests[q.id])continue;
    if(q.need.quests&&!Object.keys(q.need.quests).every(k=>S.quests[k]))continue;   // chain-locked
    const st=questState(q);
    out.push({key:'quest:'+q.id,kind:'quest',title:`Quest: ${q.n}`,sub:st==='ready'?'ready to claim':reqParts(q.need,S).slice(0,2).join(' · '),p:reqProgress(q.need,S)});
  }
  for(const r of ROOMS){
    const nt=room(r.id)+1;if(nt>r.max)continue;
    const c=r.cost(nt);let p=0,n=0;
    for(const k in c){n++;p+=Math.min(1,(k==='gp'?S.gp:have(k))/c[k]);}
    out.push({key:'room:'+r.id+':'+nt,kind:'room',id:r.id,title:`${r.n} ${ROMAN[nt]}`,sub:r.desc(nt),p:n?p/n:1});
  }
  return out;
}
function nextGoals(n){
  const all=allGoals();
  const pinned=S.pin&&all.find(g=>g.key===S.pin);
  const rest=all.filter(g=>g!==pinned&&g.p<1).sort((a,b)=>b.p-a.p);
  // ready-to-claim quests and diary tiers already show as pips; keep the card about what is next
  const list=(pinned?[pinned]:[]).concat(rest).slice(0,n);
  if(pinned)pinned.pinned=true;
  return list;
}
/* Called on level-ups and claims: tells the player the pinned goal is reached. */
function goalCheck(){
  if(!S.pin)return;
  const g=allGoals().find(x=>x.key===S.pin);
  const reached=!g||g.p>=1||g.done;
  if(reached){toast('Pinned goal reached'+(g?` — ${g.title}`:''));buzz('big');S.pin=null;}
}

/* ============================================================
   PERSISTENCE
   ============================================================ */
let curSlot=1;
let slotInfo=[null,null,null];

function summarize(o){
  try{
    if(typeof o==='string')o=JSON.parse(o);
    if(!o||!o.xp)return null;
    let tl=0;for(const k of ALL_SKILLS)tl+=lvlFor(o.xp[k]||0);
    return{lvl:tl,gp:o.gp||0,played:o.played||0,last:o.last||0,pets:Object.keys(o.pets||{}).length};
  }catch(e){return null;}
}
/* Rolling backups (9.5): once an hour the save is also copied to a backup key,
   and the hour before that is kept as a second one, so a bad restore or a
   corrupt write never costs more than an hour or two. */
const BAK_EVERY=3600000;
const bakKey=(i,n)=>`hollowmere:slot:${i}:bak${n}`;
async function save(){
  S.last=Date.now();
  const data=JSON.stringify(S);
  if(S.last-(S.bakAt||0)>=BAK_EVERY&&S.played>60000){
    const prev=await Store.get(bakKey(curSlot,1));
    if(prev)await Store.set(bakKey(curSlot,2),prev);
    S.bakAt=S.last;
    await Store.set(bakKey(curSlot,1),JSON.stringify(S));
  }
  const okw=await Store.set(slotKey(curSlot),data);
  await Store.set(META,JSON.stringify({slot:curSlot}));
  slotInfo[curSlot-1]=summarize(S);
  if(!okw)console.error('save failed');
  return okw;
}
async function refreshSlots(){
  for(let i=1;i<=SLOTS_N;i++){
    const raw=await Store.get(slotKey(i));
    slotInfo[i-1]=raw?summarize(raw):null;
  }
}
function adopt(p){
  const f=fresh();
  S=Object.assign(f,p);
  S.xp=Object.assign(fresh().xp,p.xp||{});
  S.equip=Object.assign(fresh().equip,p.equip||{});
  S.sess=Object.assign(fresh().sess,p.sess||{});
  S.house=Object.assign(fresh().house,p.house||{});
  S.farm=Array.isArray(p.farm)?p.farm:f.farm;
  S.offers=adoptOffers(p.offers);
  S.market=p.market||{};S.pets=p.pets||{};
  S.buffs=p.buffs||{};S.bossKills=p.bossKills||{};S.delve=p.delve||null;S.deepest=p.deepest||{};S.made=p.made||{};S.cleared=p.cleared||{};
  S.diary=p.diary||{};S.tasksDone=p.tasksDone||0;
  if(!p.clog)clogBackfill();
  S.errands=Object.assign(fresh().errands,p.errands||{});S.well=Object.assign(fresh().well,p.well||{});
  S.notify=Object.assign(fresh().notify,p.notify||{});
  S.marks=p.marks||0;S.guild=p.guild||{};S.trails=p.trails||{};S.trailsDone=p.trailsDone||{};
  /* 7.9: a save from before the Art setting keeps the text-only look it had.
     New games start on HD poly through fresh(). */
  S.art=['off','lp','hd'].includes(p.art)?p.art:'off';
  S.ramparts=Object.assign(fresh().ramparts,p.ramparts||{});
  S.patches=p.patches||3;S.bankTier=p.bankTier||0;
  S.geMs=p.geMs||0;S.played=p.played||0;S.started=p.started||Date.now();
  while(S.farm.length<totalPatches())S.farm.push({crop:null,ms:0});
  S.v=SAVE_VERSION;
}
async function loadSlot(i){
  await save();                       // never lose the slot you are leaving
  curSlot=i;
  const raw=await Store.get(slotKey(i));
  if(raw){try{adopt(JSON.parse(raw));}catch(e){S=fresh();}}
  else S=fresh();
  if(!S.task)rollTask();
  await Store.set(META,JSON.stringify({slot:curSlot}));
  await refreshSlots();
  return true;
}
async function load(){
  try{const m=await Store.get(META);if(m){const o=JSON.parse(m);
    if(o&&o.slot>=1&&o.slot<=SLOTS_N)curSlot=o.slot;}}catch(e){}
  const raw=await Store.get(slotKey(curSlot));
  if(raw){try{adopt(JSON.parse(raw));await refreshSlots();return true;}catch(e){}}
  try{                                // migrate a pre-slots save into slot 1
    const legacy=await Store.get(SAVE);
    if(legacy){const p=JSON.parse(legacy);
      if(p&&p.xp){adopt(p);curSlot=1;await save();await refreshSlots();return true;}}
  }catch(e){}
  S=fresh();await refreshSlots();return false;
}
async function wipe(){
  await Store.del(slotKey(curSlot));
  S=fresh();rollTask();await refreshSlots();render();toast('Slot cleared');
}

