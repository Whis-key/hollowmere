
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
function fresh(){
  const xp={};for(const k of ALL_SKILLS)xp[k]=0;
  xp.hitpoints=XP[9];
  return{xp,bank:{},gp:25,tools:{axe:0,pick:0,rod:0},
    equip:{weapon:null,shield:null,head:null,body:null,amulet:null},
    hp:10,act:null,prog:0,foe:null,foeHp:0,foeTimer:0,stun:0,
    kills:{},quests:{},task:null,capes:{},log:[],
    sess:{kills:0,gp:0,dealt:0,taken:0,eaten:0,deaths:0,swings:0,hits:0},
    farm:[{crop:null,ms:0},{crop:null,ms:0},{crop:null,ms:0}],patches:3,
    buffs:{},bankTier:0,bossKills:{},delve:null,deepest:{},made:{},cleared:{},
    house:{altar:0,workshop:0,garden:0,kitchen:0,storeroom:0,trophy:0},
    market:{},offers:[],geMs:0,pets:{},started:Date.now(),played:0,last:Date.now()};
}
let S;
function lvl(s){return lvlFor(S.xp[s]||0);}
function maxHp(){return lvl('hitpoints');}
function gear(){
  let str=0,def=0,spd=2800;
  for(const sl of SLOTS){const id=S.equip[sl];if(!id||!EQ[id])continue;
    const e=EQ[id];str+=e.str||0;def+=e.def||0;if(sl==='weapon'&&e.spd)spd=e.spd;}
  return{str,def,spd};
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
function combatLvl(){return Math.floor((lvl('attack')+lvl('strength')+lvl('defence')+lvl('hitpoints'))/4);}
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
    const want=Math.floor(o.qty*speed*(0.6+Math.random()*0.8));
    if(want<=0)continue;
    const take=Math.min(want,o.qty-o.filled);
    if(o.kind==='sell'){o.filled+=take;S.gp+=take*o.price;o.got=(o.got||0)+take*o.price;}
    else{const g=add(o.id,take);o.filled+=g;o.got=(o.got||0)+g;if(g<take)break;}
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
    if(gains)gains.pets=(gains.pets||[]).concat(PETS[id]);
    else{pushLog(`A ${PETS[id]} follows you home!`,'kill');toast(`Pet: ${PETS[id]}`);}
  }
}
function room(id){return (S.house&&S.house[id])||0;}
function ringGold(){const r=S.equip.ring;return r&&EQ[r]&&EQ[r].gold?EQ[r].gold:0;}
function goldMul(){return 1+room('trophy')*0.07+ringGold();}
function gainGp(n){const g=Math.round(n*goldMul());S.gp+=g;noteGp(g);return g;}
function totalPatches(){return Math.min(8,(S.patches||3)+room('garden'));}
/* Bank capacity is SLOTS — distinct item types. Stacks are unlimited, the way
   they are in RuneScape. An over-cap save (from before the switch) keeps
   everything it holds and is only blocked from taking on NEW item types, so
   nobody loses anything on the changeover. */
function bankCap(){return BANK_TIERS[S.bankTier||0]+room('storeroom')*8;}
function bankUsed(){let n=0;for(const k in S.bank)if(S.bank[k]>0)n++;return n;}
function bankFull(){return bankUsed()>=bankCap();}
function hasSlot(id){return !!S.bank[id]||bankUsed()<bankCap();}
// How many free slots a set of incoming ids would consume.
function slotsFor(ids){let n=0;for(const id of ids)if(!S.bank[id])n++;return n;}
function add(id,n){
  if(!hasSlot(id)){pushLog(`No free bank slot — ${n}× ${item(id).n} lost`,'miss');return 0;}
  S.bank[id]=(S.bank[id]||0)+n;
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
  if((S.offers||[]).length>=GE_SLOTS){toast('No free offer slots');return;}
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
  if((S.offers||[]).length>=GE_SLOTS){toast('No free offer slots');return;}
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
  S.gp-=st.cost*n;add(id,n);
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
function actDur(sk,a){
  const t=SKILLS[sk].tool;
  let d=t?a.dur*TOOLS[t][S.tools[t]].mul:a.dur;
  if(CRAFT_SKILLS.includes(sk))d*=(1-room('workshop')*0.07);
  return Math.max(500,d);
}

/* ============================================================
   ENGINE
   ============================================================ */
let gains=null;
function grantXp(sk,amount){
  if(!amount)return;
  if(sk==='prayer')amount=Math.round(amount*(1+room('altar')*0.15));
  const before=lvlFor(S.xp[sk]||0);
  S.xp[sk]=Math.min(XP[98],(S.xp[sk]||0)+amount);
  const after=lvlFor(S.xp[sk]);
  if(gains)gains.xp[sk]=(gains.xp[sk]||0)+amount;
  if(after>before){
    if(after===99&&!S.capes[sk]){S.capes[sk]=1;add(sk+'_cape',1);
      if(gains)gains.capes.push(sk);else toast(`${label(sk)} 99 — cape earned`);}
    else if(!gains)toast(`${label(sk)} level ${after}`);
  }
}
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
    if(!canPay(a.in)){S.prog=0;if(!gains)toast('Out of materials');S.act=null;return;}
    if(a.out&&slotsFor(Object.keys(a.out))>bankCap()-bankUsed()){
      S.prog=0;if(!gains)toast('No free bank slot');S.act=null;return;}
    S.prog-=dur;
    if(a.fail!==undefined&&Math.random()<a.fail){
      grantXp(skill,Math.round(a.xp*0.15));
      S.stun=a.stun;
      if(gains)gains.fails=(gains.fails||0)+1;else pushLog('Caught — stunned');
      return;
    }
    if(a.in)for(const k in a.in)take(k,a.in[k]);
    if(a.out)for(const k in a.out){countMade(k,add(k,a.out[k]));noteItem(k,a.out[k]);}
    if(a.gp)gainGp(a.gp[0]+Math.floor(Math.random()*(a.gp[1]-a.gp[0]+1)));
    for(const d of rollLoot(a.loot)){add(d.id,d.qty);noteItem(d.id,d.qty);
      if(!gains)toast(`Found ${d.qty}× ${item(d.id).n}`);}
    grantXp(skill,a.xp);
    rollPet(skill,dur);
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
    const hitChance=Math.max(.25,Math.min(.95,.62+(styleLvl(st)-foe.lvl)*.012+buffTotal('acc')/100+tri));
    S.sess.swings++;
    if(ammo)take(ammo,1);
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
        const gp=gainGp(foe.gp[0]+Math.floor(Math.random()*(foe.gp[1]-foe.gp[0]+1)));
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
            if(deep===0){S.cleared[d.id]=(S.cleared[d.id]||0)+1;grantXp('slayer',d.bonusXp);gainGp(d.bonusGp);
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
            const bg=gainGp(d.bonusGp);
            for(const u of rollLoot({id:d.ring,c:d.ringC})){add(u.id,u.qty);noteItem(u.id,u.qty);
              pushLog(`${item(u.id).n} drops!`,'kill');
              if(gains)gains.uniques=(gains.uniques||0)+1;else toast(`${item(u.id).n}!`);}
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
                if(gains)gains.uniques=(gains.uniques||0)+1;else toast(`${item(u.id).n}!`);}
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
            if(gains)gains.uniques=(gains.uniques||0)+1;else toast(`${item(u.id).n}!`);}
          if(!uq.length)pushLog('No unique this time','miss');
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
        if(gains)gains.died=true;else pushLog(`You died to ${foe.n}. Lost ${lost} gp.`,'dead');
        return;
      }
      if(S.hp<=maxHp()*.45)autoEat();
      // Retreat before a hit that COULD kill, not at a flat percentage — otherwise a
      // hard-hitting foe jumps straight over the safety net.
      const lethal=Math.max(1,foe.max-blocked);
      if(S.hp<=Math.max(maxHp()*.30,lethal)&&!Object.keys(S.bank).some(k=>I[k]&&I[k].heal&&S.bank[k]>0)){
        S.act=null;S.foe=null;
        pushLog('Out of food — retreated before dying','dead');
        if(gains)gains.retreated=true;else toast('Retreated — no food left');
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
  const healed=Math.round(I[pick].heal*(1+room('kitchen')*0.25));
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
  const bonus=Math.round(foe.xp*S.task.need*0.9);
  const gp=Math.round(foe.gp[1]*S.task.need*0.6);
  grantXp('slayer',bonus);gainGp(gp);
  if(gains)gains.tasks=(gains.tasks||0)+1;
  else{pushLog(`Task complete — ${S.task.need}× ${foe.n} for ${fmt(bonus)} slayer xp and ${fmt(gp)} gp`,'task');
    toast(`Task done — ${fmt(bonus)} slayer xp`);}
  if(Math.random()<.35){add('boss_sigil',1);noteItem('boss_sigil',1);
    if(!gains)pushLog('A boss sigil falls from the reward','loot');}
  S.task=null;
  rollTask();
}

/* ---- Requirements ---- */
/* One requirement engine, shared by quests and (from 7.0) the achievement diary.
   A requirement is an object of check types, e.g. {lvl:{mining:20},items:{iron_ore:30}},
   and every check listed must pass. Each type says how to read its current value
   and what to call itself, so a single definition drives both whether it is met
   and the progress text on screen.
   meets() and reqParts() read the state they are handed rather than S, per the
   PVP-foundation rule: a requirement should be checkable against any player.
   Types are checked and listed in the order below. The first three are the
   originals and must stay first and in this order — the quest screen shows them
   that way. lvl is deliberately unclamped ("Mining 45/20"), matching how the
   screen has always shown levels; kills and items cap at the target. */
const REQ_TYPES={
  lvl:    {cur:(st,k)=>lvlFor((st.xp||{})[k]||0),       name:k=>label(k),  clamp:false},
  kills:  {cur:(st,k)=>(st.kills||{})[k]||0,             name:k=>(allFoes().find(f=>f.id===k)||{n:k}).n},
  items:  {cur:(st,k)=>(st.bank||{})[k]||0,              name:k=>item(k).n, handIn:true},   // consumed on claim
  total:  {cur:st=>ALL_SKILLS.reduce((n,k)=>n+lvlFor((st.xp||{})[k]||0),0), name:()=>'Total level', single:true},
  bosses: {cur:(st,k)=>(st.bossKills||{})[k]||0,         name:k=>(BOSSES.find(b=>b.id===k)||{n:k}).n},
  cleared:{cur:(st,k)=>(st.cleared||{})[k]||0,           name:k=>(DUNGEONS.find(d=>d.id===k)||{n:k}).n+' clears'},
  depth:  {cur:(st,k)=>(st.deepest||{})[k]||0,           name:k=>(DUNGEONS.find(d=>d.id===k)||{n:k}).n+' depth'},
  quests: {cur:(st,k)=>(st.quests||{})[k]?1:0,           name:k=>(QUESTS.find(q=>q.id===k)||{n:k}).n},
  have:   {cur:(st,k)=>(st.bank||{})[k]||0,              name:k=>item(k).n},                // held, never consumed
  made:   {cur:(st,k)=>(st.made||{})[k]||0,              name:k=>item(k).n+' made'},
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
  return reqEntries(req).map(e=>{const c=e.T.cur(st,e.k);
    return `${e.T.name(e.k)} ${e.T.clamp===false?c:Math.min(c,e.need)}/${e.need}`;});
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
  toast(`Quest complete — ${q.n}`);
}
function questsReady(){return QUESTS.some(q=>questState(q)==='ready');}

/* ============================================================
   OFFLINE
   ============================================================ */
const OFFLINE_CAP=12*3600*1000;
function catchUp(){
  const now=Date.now();
  let elapsed=Math.min(now-(S.last||now),OFFLINE_CAP);
  S.last=now;
  if(elapsed<20000)return null;
  const ripeBefore=S.farm.filter(p=>p.crop&&p.ms<=0).length;
  gains={xp:{},items:{},gp:0,died:false,events:0,fails:0,tasks:0,capes:[],ms:elapsed};
  const step=250;let guard=0;
  while(elapsed>0&&S.act&&guard++<300000){const d=Math.min(step,elapsed);tick(d);elapsed-=d;}
  // crops and potion timers keep running even with no skill set, or after one stops
  if(elapsed>0){farmTick(elapsed);buffTick(elapsed);geTick(elapsed);}
  gains.ripened=S.farm.filter(p=>p.crop&&p.ms<=0).length-ripeBefore;
  const out=gains;gains=null;return out;
}
function showCatchUp(r){
  if(!r)return;
  const li=[];const hrs=r.ms/3600000;
  li.push(`<li>Away ${hrs>=1?hrs.toFixed(1)+' hours':Math.round(r.ms/60000)+' minutes'}</li>`);
  for(const k in r.xp)if(r.xp[k]>0)li.push(`<li>${label(k)} +${fmt(Math.round(r.xp[k]))} xp</li>`);
  for(const k in r.items)li.push(`<li>${item(k).n} ×${fmt(r.items[k])}</li>`);
  if(r.gp)li.push(`<li>${fmt(r.gp)} gp</li>`);
  if(r.tasks)li.push(`<li>${r.tasks} slayer task${r.tasks>1?'s':''} finished</li>`);
  if(r.ripened>0)li.push(`<li>${r.ripened} crop${r.ripened>1?'s':''} ready to harvest</li>`);
  if(r.trades)li.push(`<li>${r.trades} market offer${r.trades>1?'s':''} completed</li>`);
  for(const pn of (r.pets||[]))li.push(`<li><b>Pet found: ${pn}</b></li>`);
  if(r.retreated)li.push(`<li>Retreated from combat — you ran out of food</li>`);
  if(r.haulGp)li.push(`<li>Left a dungeon with ${fmt(r.haulGp)} gp of haul banked</li>`);
  if(r.haulLost)li.push(`<li><b>Died deep — ${fmt(r.haulLost)} gp of dungeon haul lost</b></li>`);
  if(r.delves)li.push(`<li>${r.delves} dungeon${r.delves>1?'s':''} cleared</li>`);
  if(r.uniques)li.push(`<li><b>${r.uniques} boss unique dropped</b></li>`);
  if(r.events)li.push(`<li>${r.events} chance encounter${r.events>1?'s':''}</li>`);
  for(const c of r.capes)li.push(`<li><b>${label(c)} 99 — cape earned</b></li>`);
  if(r.died)li.push(`<li>You died at some point. Bring more food.</li>`);
  if(li.length<2)return;
  document.getElementById('wblist').innerHTML=li.join('');
  document.getElementById('wb').classList.add('show');
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
async function save(){
  S.last=Date.now();
  const okw=await Store.set(slotKey(curSlot),JSON.stringify(S));
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
  S.patches=p.patches||3;S.bankTier=p.bankTier||0;
  S.geMs=p.geMs||0;S.played=p.played||0;S.started=p.started||Date.now();
  while(S.farm.length<totalPatches())S.farm.push({crop:null,ms:0});
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

