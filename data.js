/* ============================================================
   XP TABLE — the classic curve, levels 1..99
   ============================================================ */
const XP=[0];
(function(){let t=0;for(let l=1;l<99;l++){t+=Math.floor(l+300*Math.pow(2,l/7));XP.push(Math.floor(t/4));}})();
function lvlFor(xp){let l=1;while(l<99&&XP[l]<=xp)l++;return l;}
function xpInto(xp){const l=lvlFor(xp);if(l>=99)return{pct:100};
  const a=XP[l-1],b=XP[l];return{pct:((xp-a)/(b-a))*100};}

/* ============================================================
   ITEMS
   ============================================================ */
const I={
  pine_logs:{n:'Pine logs',v:4}, oak_logs:{n:'Oak logs',v:12}, willow_logs:{n:'Willow logs',v:26},
  maple_logs:{n:'Maple logs',v:48}, yew_logs:{n:'Yew logs',v:110}, elder_logs:{n:'Elder logs',v:230},
  copper_ore:{n:'Copper ore',v:5}, tin_ore:{n:'Tin ore',v:5}, iron_ore:{n:'Iron ore',v:16},
  coal:{n:'Coal',v:32}, cobalt_ore:{n:'Cobalt ore',v:90}, adamant_ore:{n:'Adamant ore',v:210},
  starsteel_ore:{n:'Starsteel ore',v:600},
  bronze_bar:{n:'Bronze bar',v:22}, iron_bar:{n:'Iron bar',v:44}, steel_bar:{n:'Steel bar',v:130},
  cobalt_bar:{n:'Cobalt bar',v:380}, adamant_bar:{n:'Adamant bar',v:900}, starsteel_bar:{n:'Starsteel bar',v:2400},
  raw_minnow:{n:'Raw minnow',v:3}, raw_trout:{n:'Raw trout',v:14}, raw_perch:{n:'Raw perch',v:40},
  raw_sturgeon:{n:'Raw sturgeon',v:105}, raw_shark:{n:'Raw shark',v:280},
  minnow:{n:'Minnow',v:6,heal:3}, trout:{n:'Trout',v:24,heal:8}, perch:{n:'Perch',v:62,heal:14},
  sturgeon:{n:'Sturgeon',v:150,heal:22}, shark:{n:'Shark',v:390,heal:32},
  bones:{n:'Bones',v:3}, big_bones:{n:'Big bones',v:14},
  pelt:{n:'Wolf pelt',v:75}, leather:{n:'Leather',v:110}, hard_leather:{n:'Hard leather',v:260},
  silk:{n:'Silk',v:60}, shard:{n:'Void shard',v:900},
  uncut_sapphire:{n:'Uncut sapphire',v:180}, uncut_emerald:{n:'Uncut emerald',v:420},
  uncut_ruby:{n:'Uncut ruby',v:1100}, uncut_diamond:{n:'Uncut diamond',v:2800},
  vial:{n:'Vial of water',v:12}, feather:{n:'Feather',v:4},
  rune_essence:{n:'Blank runestone',v:8},
  ember_rune:{n:'Ember rune',v:26,ammo:'rune',str:5},
  frost_rune:{n:'Frost rune',v:70,ammo:'rune',str:12},
  storm_rune:{n:'Storm rune',v:190,ammo:'rune',str:24},
  void_rune:{n:'Void rune',v:520,ammo:'rune',str:40},
  bronze_arrow:{n:'Bronze arrow',v:6,ammo:'arrow',str:4},
  iron_arrow:{n:'Iron arrow',v:15,ammo:'arrow',str:9},
  steel_arrow:{n:'Steel arrow',v:42,ammo:'arrow',str:17},
  cobalt_arrow:{n:'Cobalt arrow',v:110,ammo:'arrow',str:28},
  adamant_arrow:{n:'Adamant arrow',v:280,ammo:'arrow',str:41},
  starsteel_arrow:{n:'Starsteel arrow',v:700,ammo:'arrow',str:56},
  newt_eye:{n:'Newt eye',v:20}, goblin_ash:{n:'Goblin ash',v:45},
  troll_fat:{n:'Troll fat',v:180}, wraith_dust:{n:'Wraith dust',v:520},
  boss_sigil:{n:'Boss sigil',v:0},
  grimy_bitterleaf:{n:'Grimy bitterleaf',v:25}, bitterleaf:{n:'Bitterleaf',v:60},
  grimy_marshroot:{n:'Grimy marshroot',v:60}, marshroot:{n:'Marshroot',v:140},
  grimy_emberwort:{n:'Grimy emberwort',v:130}, emberwort:{n:'Emberwort',v:300},
  grimy_sunthistle:{n:'Grimy sunthistle',v:280}, sunthistle:{n:'Sunthistle',v:640},
  grimy_frostvein:{n:'Grimy frostvein',v:600}, frostvein:{n:'Frostvein',v:1400},
  grimy_starbloom:{n:'Grimy starbloom',v:1400}, starbloom:{n:'Starbloom',v:3200},
  seed_bitterleaf:{n:'Bitterleaf seed',v:30}, seed_marshroot:{n:'Marshroot seed',v:90},
  seed_emberwort:{n:'Emberwort seed',v:220}, seed_sunthistle:{n:'Sunthistle seed',v:520},
  seed_frostvein:{n:'Frostvein seed',v:1200}, seed_starbloom:{n:'Starbloom seed',v:2800},
  attack_potion:{n:'Attack potion',v:180,buff:{acc:8},ms:360000},
  strength_potion:{n:'Strength potion',v:340,buff:{str:6},ms:360000},
  defence_potion:{n:'Defence potion',v:520,buff:{def:10},ms:360000},
  combat_potion:{n:'Combat potion',v:1400,buff:{str:8,def:12,acc:8},ms:480000},
  super_potion:{n:'Super potion',v:4200,buff:{str:16,def:22,acc:12},ms:600000},
  sapphire:{n:'Sapphire',v:300}, emerald:{n:'Emerald',v:700}, ruby:{n:'Ruby',v:1800}, diamond:{n:'Diamond',v:4500},
};
const EQ={
  bronze_sword:{n:'Bronze sword',v:120,slot:'weapon',str:3,spd:2400},
  iron_sword:{n:'Iron sword',v:300,slot:'weapon',str:7,spd:2400},
  steel_sword:{n:'Steel sword',v:850,slot:'weapon',str:13,spd:2300},
  cobalt_sword:{n:'Cobalt sword',v:2400,slot:'weapon',str:22,spd:2200},
  adamant_sword:{n:'Adamant sword',v:5800,slot:'weapon',str:33,spd:2100},
  starsteel_sword:{n:'Starsteel sword',v:15000,slot:'weapon',str:48,spd:2000},
  bronze_kite:{n:'Bronze kite shield',v:150,slot:'shield',def:5},
  iron_kite:{n:'Iron kite shield',v:380,slot:'shield',def:11},
  steel_kite:{n:'Steel kite shield',v:1100,slot:'shield',def:20},
  cobalt_kite:{n:'Cobalt kite shield',v:3000,slot:'shield',def:34},
  adamant_kite:{n:'Adamant kite shield',v:7200,slot:'shield',def:52},
  starsteel_kite:{n:'Starsteel kite shield',v:18000,slot:'shield',def:74},
  bronze_plate:{n:'Bronze breastplate',v:200,slot:'body',def:8},
  iron_plate:{n:'Iron breastplate',v:500,slot:'body',def:17},
  steel_plate:{n:'Steel breastplate',v:1400,slot:'body',def:30},
  cobalt_plate:{n:'Cobalt breastplate',v:3900,slot:'body',def:50},
  adamant_plate:{n:'Adamant breastplate',v:9200,slot:'body',def:76},
  starsteel_plate:{n:'Starsteel breastplate',v:24000,slot:'body',def:108},
  leather_coif:{n:'Leather coif',v:190,slot:'head',def:4},
  hard_coif:{n:'Hard leather coif',v:520,slot:'head',def:10},
  studded_coif:{n:'Studded coif',v:1600,slot:'head',def:19},
  sapphire_amulet:{n:'Sapphire amulet',v:700,slot:'amulet',def:3,str:2},
  emerald_amulet:{n:'Emerald amulet',v:1500,slot:'amulet',def:6,str:4},
  ruby_amulet:{n:'Ruby amulet',v:3800,slot:'amulet',def:9,str:8},
  diamond_amulet:{n:'Diamond amulet',v:9000,slot:'amulet',def:14,str:13},
  oak_bow:{n:'Oak shortbow',v:260,slot:'weapon',type:'ranged',str:2,spd:2200},
  willow_bow:{n:'Willow shortbow',v:700,slot:'weapon',type:'ranged',str:5,spd:2100},
  maple_bow:{n:'Maple shortbow',v:1900,slot:'weapon',type:'ranged',str:9,spd:2000},
  yew_bow:{n:'Yew longbow',v:5200,slot:'weapon',type:'ranged',str:15,spd:1950},
  elder_bow:{n:'Elder longbow',v:14000,slot:'weapon',type:'ranged',str:23,spd:1900},
  ember_staff:{n:'Ember staff',v:600,slot:'weapon',type:'magic',str:3,spd:2300},
  frost_staff:{n:'Frost staff',v:1900,slot:'weapon',type:'magic',str:8,spd:2200},
  storm_staff:{n:'Storm staff',v:5400,slot:'weapon',type:'magic',str:15,spd:2100},
  void_staff:{n:'Void staff',v:16000,slot:'weapon',type:'magic',str:24,spd:2000},
  ring_vigour:{n:'Ring of Vigour',v:26000,slot:'ring',str:6},
  ring_warding:{n:'Ring of Warding',v:34000,slot:'ring',def:18},
  ring_fortune:{n:'Ring of Fortune',v:60000,slot:'ring',def:4,gold:.25,wealth:1},
  warden_blade:{n:"Warden's blade",v:18000,slot:'weapon',str:40,spd:1800},
  tyrant_plate:{n:'Tyrant breastplate',v:30000,slot:'body',def:96},
  hollow_crown:{n:'Crown of Hollowmere',v:120000,slot:'head',def:34,str:12},
  /* Endgame drops. These two DO beat the best craftable in their slot, unlike
     the blade and the breastplate above, which are a power spike at their own
     tier that starsteel later overtakes. */
  wyrm_aegis:{n:'Wyrmscale aegis',v:40000,slot:'shield',def:95},
  starless_amulet:{n:'Amulet of the Starless',v:55000,slot:'amulet',str:20,def:21},
};
const CAPES={};
for(const k of ['woodcutting','mining','fishing','firemaking','cooking','smithing','thieving','crafting','prayer','slayer','attack','strength','defence','hitpoints']){
  CAPES[k+'_cape']={n:cap0(k)+' cape',v:99000,slot:'body',def:12,str:4};
}
function cap0(s){return s[0].toUpperCase()+s.slice(1);}
Object.assign(EQ,CAPES);
function item(id){return I[id]||EQ[id]||{n:id,v:0};}
const SLOTS=['weapon','shield','head','body','amulet','ring'];

/* ============================================================
   ACTIONS
   ============================================================ */
const g=(id,n,lvl,xp,dur,out,loot)=>({id,n,lvl,xp,dur,out:{[out]:1},loot});
const SKILLS={
  woodcutting:{n:'Woodcutting',tool:'axe',acts:[
    g('t1','Pine tree',1,25,6000,'pine_logs'), g('t2','Oak tree',15,38,7600,'oak_logs'),
    g('t3','Willow tree',30,68,9600,'willow_logs'), g('t4','Maple tree',45,100,12000,'maple_logs'),
    g('t5','Yew tree',60,175,16000,'yew_logs'), g('t6','Elder tree',75,250,20000,'elder_logs'),
  ]},
  mining:{n:'Mining',tool:'pick',acts:[
    g('m1','Copper vein',1,18,6000,'copper_ore'), g('m2','Tin vein',1,18,6000,'tin_ore'),
    g('m3','Iron vein',15,35,7600,'iron_ore',{table:'gem',c:.009}),
    g('m4','Coal seam',30,50,10000,'coal',{table:'gem',c:.017}),
    g('m5','Cobalt vein',50,80,13000,'cobalt_ore',{table:'gem',c:.041}),
    g('m6','Adamant vein',70,140,17000,'adamant_ore',{table:'gem_rich',c:.030}),
    g('m7','Starsteel vein',85,240,22000,'starsteel_ore',{table:'gem_rich',c:.075}),
  ]},
  fishing:{n:'Fishing',tool:'rod',acts:[
    g('f1','Net minnows',1,20,6400,'raw_minnow'), g('f2','Bait trout',20,45,8400,'raw_trout'),
    g('f3','Cage perch',40,80,11000,'raw_perch'), g('f4','Harpoon sturgeon',55,130,14000,'raw_sturgeon'),
    g('f5','Harpoon shark',76,220,19000,'raw_shark'),
  ]},
  firemaking:{n:'Firemaking',acts:[
    {id:'b1',n:'Burn pine',lvl:1,xp:40,dur:4800,in:{pine_logs:1}},
    {id:'b2',n:'Burn oak',lvl:15,xp:60,dur:4800,in:{oak_logs:1}},
    {id:'b3',n:'Burn willow',lvl:30,xp:90,dur:4800,in:{willow_logs:1}},
    {id:'b4',n:'Burn maple',lvl:45,xp:135,dur:4800,in:{maple_logs:1}},
    {id:'b5',n:'Burn yew',lvl:60,xp:203,dur:4800,in:{yew_logs:1}},
    {id:'b6',n:'Burn elder',lvl:75,xp:304,dur:4800,in:{elder_logs:1}},
  ]},
  cooking:{n:'Cooking',acts:[
    {id:'c1',n:'Cook minnow',lvl:1,xp:30,dur:4400,in:{raw_minnow:1},out:{minnow:1}},
    {id:'c2',n:'Cook trout',lvl:20,xp:70,dur:4400,in:{raw_trout:1},out:{trout:1}},
    {id:'c3',n:'Cook perch',lvl:40,xp:120,dur:4400,in:{raw_perch:1},out:{perch:1}},
    {id:'c4',n:'Cook sturgeon',lvl:55,xp:190,dur:4400,in:{raw_sturgeon:1},out:{sturgeon:1}},
    {id:'c5',n:'Cook shark',lvl:76,xp:300,dur:4400,in:{raw_shark:1},out:{shark:1}},
  ]},
  smithing:{n:'Smithing',acts:[
    {sub:'Smelting'},
    {id:'s1',n:'Smelt bronze',lvl:1,xp:24,dur:6000,in:{copper_ore:1,tin_ore:1},out:{bronze_bar:1}},
    {id:'s2',n:'Smelt iron',lvl:15,xp:44,dur:6000,in:{iron_ore:1},out:{iron_bar:1}},
    {id:'s3',n:'Smelt steel',lvl:30,xp:70,dur:6800,in:{iron_ore:1,coal:2},out:{steel_bar:1}},
    {id:'s4',n:'Smelt cobalt',lvl:50,xp:120,dur:8000,in:{cobalt_ore:1,coal:4},out:{cobalt_bar:1}},
    {id:'s5',n:'Smelt adamant',lvl:70,xp:190,dur:9200,in:{adamant_ore:1,coal:6},out:{adamant_bar:1}},
    {id:'s6',n:'Smelt starsteel',lvl:85,xp:300,dur:10400,in:{starsteel_ore:1,coal:8},out:{starsteel_bar:1}},
    {sub:'Forging — weapons'},
    {id:'w1',n:'Bronze sword',lvl:5,xp:60,dur:8000,in:{bronze_bar:3},out:{bronze_sword:1}},
    {id:'w2',n:'Iron sword',lvl:20,xp:110,dur:8000,in:{iron_bar:3},out:{iron_sword:1}},
    {id:'w3',n:'Steel sword',lvl:35,xp:180,dur:8800,in:{steel_bar:3},out:{steel_sword:1}},
    {id:'w4',n:'Cobalt sword',lvl:55,xp:290,dur:10000,in:{cobalt_bar:3},out:{cobalt_sword:1}},
    {id:'w5',n:'Adamant sword',lvl:75,xp:450,dur:11200,in:{adamant_bar:3},out:{adamant_sword:1}},
    {id:'w6',n:'Starsteel sword',lvl:90,xp:700,dur:12400,in:{starsteel_bar:3},out:{starsteel_sword:1}},
    {sub:'Forging — armour'},
    {id:'k1',n:'Bronze kite shield',lvl:6,xp:80,dur:8400,in:{bronze_bar:4},out:{bronze_kite:1}},
    {id:'k2',n:'Iron kite shield',lvl:21,xp:150,dur:8400,in:{iron_bar:4},out:{iron_kite:1}},
    {id:'k3',n:'Steel kite shield',lvl:36,xp:240,dur:9200,in:{steel_bar:4},out:{steel_kite:1}},
    {id:'k4',n:'Cobalt kite shield',lvl:56,xp:390,dur:10400,in:{cobalt_bar:4},out:{cobalt_kite:1}},
    {id:'k5',n:'Adamant kite shield',lvl:76,xp:600,dur:11600,in:{adamant_bar:4},out:{adamant_kite:1}},
    {id:'k6',n:'Starsteel kite shield',lvl:91,xp:930,dur:12800,in:{starsteel_bar:4},out:{starsteel_kite:1}},
    {id:'a1',n:'Bronze breastplate',lvl:8,xp:100,dur:9200,in:{bronze_bar:5},out:{bronze_plate:1}},
    {id:'a2',n:'Iron breastplate',lvl:23,xp:185,dur:9200,in:{iron_bar:5},out:{iron_plate:1}},
    {id:'a3',n:'Steel breastplate',lvl:38,xp:300,dur:10000,in:{steel_bar:5},out:{steel_plate:1}},
    {id:'a4',n:'Cobalt breastplate',lvl:58,xp:480,dur:11200,in:{cobalt_bar:5},out:{cobalt_plate:1}},
    {id:'a5',n:'Adamant breastplate',lvl:78,xp:750,dur:12400,in:{adamant_bar:5},out:{adamant_plate:1}},
    {id:'a6',n:'Starsteel breastplate',lvl:92,xp:1150,dur:14000,in:{starsteel_bar:5},out:{starsteel_plate:1}},
  ]},
  thieving:{n:'Thieving',acts:[
    {id:'p1',n:'Fruit stall',lvl:1,xp:22,dur:5000,gp:[4,14],fail:.30,stun:4000},
    {id:'p2',n:'Silk stall',lvl:20,xp:55,dur:5600,gp:[18,45],fail:.28,stun:5000,out:{silk:1}},
    {id:'p3',n:'Gem stall',lvl:40,xp:110,dur:6400,gp:[50,130],fail:.26,stun:6000,loot:{table:'gem',c:.044}},
    {id:'p4',n:'Pickpocket noble',lvl:55,xp:190,dur:7200,gp:[130,320],fail:.24,stun:7000,loot:{table:'gem_rich',c:.042}},
    {id:'p5',n:'Rob the vault',lvl:75,xp:340,dur:8800,gp:[400,1000],fail:.22,stun:9000,loot:{table:'gem_rich',c:.15}},
  ]},
  crafting:{n:'Crafting',acts:[
    {sub:'Leatherwork'},
    {id:'r1',n:'Tan wolf pelt',lvl:1,xp:30,dur:5000,in:{pelt:1},out:{leather:1}},
    {id:'r2',n:'Leather coif',lvl:7,xp:70,dur:6000,in:{leather:2},out:{leather_coif:1}},
    {id:'r3',n:'Cure hard leather',lvl:28,xp:130,dur:6400,in:{leather:2},out:{hard_leather:1}},
    {id:'r4',n:'Hard leather coif',lvl:33,xp:210,dur:7200,in:{hard_leather:2},out:{hard_coif:1}},
    {id:'r5',n:'Studded coif',lvl:48,xp:360,dur:8000,in:{hard_leather:2,steel_bar:1},out:{studded_coif:1}},
    {sub:'Gemcutting'},
    {id:'j1',n:'Cut sapphire',lvl:20,xp:80,dur:5000,in:{uncut_sapphire:1},out:{sapphire:1}},
    {id:'j2',n:'Cut emerald',lvl:27,xp:140,dur:5400,in:{uncut_emerald:1},out:{emerald:1}},
    {id:'j3',n:'Cut ruby',lvl:34,xp:230,dur:5800,in:{uncut_ruby:1},out:{ruby:1}},
    {id:'j4',n:'Cut diamond',lvl:43,xp:380,dur:6400,in:{uncut_diamond:1},out:{diamond:1}},
    {id:'j5',n:'Sapphire amulet',lvl:24,xp:160,dur:7000,in:{sapphire:1,silk:1},out:{sapphire_amulet:1}},
    {id:'j6',n:'Emerald amulet',lvl:31,xp:270,dur:7400,in:{emerald:1,silk:1},out:{emerald_amulet:1}},
    {id:'j7',n:'Ruby amulet',lvl:50,xp:450,dur:8000,in:{ruby:1,silk:1},out:{ruby_amulet:1}},
    {id:'j8',n:'Diamond amulet',lvl:70,xp:760,dur:8800,in:{diamond:1,silk:1},out:{diamond_amulet:1}},
  ]},
  fletching:{n:'Fletching',acts:[
    {sub:'Bows'},
    {id:'n1',n:'Oak shortbow',lvl:5,xp:70,dur:6000,in:{oak_logs:2},out:{oak_bow:1}},
    {id:'n2',n:'Willow shortbow',lvl:22,xp:140,dur:6400,in:{willow_logs:2},out:{willow_bow:1}},
    {id:'n3',n:'Maple shortbow',lvl:40,xp:250,dur:7000,in:{maple_logs:2},out:{maple_bow:1}},
    {id:'n4',n:'Yew longbow',lvl:60,xp:420,dur:7600,in:{yew_logs:3},out:{yew_bow:1}},
    {id:'n5',n:'Elder longbow',lvl:80,xp:700,dur:8400,in:{elder_logs:3},out:{elder_bow:1}},
    {sub:'Arrows — 15 per batch'},
    {id:'o1',n:'Bronze arrows',lvl:1,xp:40,dur:4000,in:{pine_logs:1,feather:15,bronze_bar:1},out:{bronze_arrow:15}},
    {id:'o2',n:'Iron arrows',lvl:15,xp:75,dur:4000,in:{pine_logs:1,feather:15,iron_bar:1},out:{iron_arrow:15}},
    {id:'o3',n:'Steel arrows',lvl:30,xp:130,dur:4400,in:{oak_logs:1,feather:15,steel_bar:1},out:{steel_arrow:15}},
    {id:'o4',n:'Cobalt arrows',lvl:50,xp:220,dur:4800,in:{willow_logs:1,feather:15,cobalt_bar:1},out:{cobalt_arrow:15}},
    {id:'o5',n:'Adamant arrows',lvl:70,xp:360,dur:5200,in:{maple_logs:1,feather:15,adamant_bar:1},out:{adamant_arrow:15}},
    {id:'o6',n:'Starsteel arrows',lvl:88,xp:580,dur:5600,in:{yew_logs:1,feather:15,starsteel_bar:1},out:{starsteel_arrow:15}},
    {sub:'Staves'},
    {id:'v1',n:'Ember staff',lvl:12,xp:120,dur:6400,in:{oak_logs:3,sapphire:1},out:{ember_staff:1}},
    {id:'v2',n:'Frost staff',lvl:34,xp:240,dur:7000,in:{willow_logs:3,emerald:1},out:{frost_staff:1}},
    {id:'v3',n:'Storm staff',lvl:56,xp:420,dur:7600,in:{maple_logs:3,ruby:1},out:{storm_staff:1}},
    {id:'v4',n:'Void staff',lvl:78,xp:720,dur:8400,in:{yew_logs:3,diamond:1},out:{void_staff:1}},
  ]},
  runecrafting:{n:'Enchanting',acts:[
    {id:'u1',n:'Ember runes ×10',lvl:1,xp:60,dur:4200,in:{rune_essence:10},out:{ember_rune:10}},
    {id:'u2',n:'Frost runes ×10',lvl:25,xp:130,dur:4600,in:{rune_essence:10,coal:1},out:{frost_rune:10}},
    {id:'u3',n:'Storm runes ×10',lvl:50,xp:250,dur:5200,in:{rune_essence:10,cobalt_ore:1},out:{storm_rune:10}},
    {id:'u4',n:'Void runes ×10',lvl:75,xp:460,dur:5800,in:{rune_essence:10,starsteel_ore:1},out:{void_rune:10}},
  ]},
  herblore:{n:'Herbalism',acts:[
    {sub:'Cleaning'},
    {id:'h1',n:'Clean bitterleaf',lvl:1,xp:25,dur:2400,in:{grimy_bitterleaf:1},out:{bitterleaf:1}},
    {id:'h2',n:'Clean marshroot',lvl:14,xp:45,dur:2400,in:{grimy_marshroot:1},out:{marshroot:1}},
    {id:'h3',n:'Clean emberwort',lvl:28,xp:80,dur:2400,in:{grimy_emberwort:1},out:{emberwort:1}},
    {id:'h4',n:'Clean sunthistle',lvl:42,xp:140,dur:2400,in:{grimy_sunthistle:1},out:{sunthistle:1}},
    {id:'h5',n:'Clean frostvein',lvl:60,xp:240,dur:2400,in:{grimy_frostvein:1},out:{frostvein:1}},
    {id:'h6',n:'Clean starbloom',lvl:78,xp:420,dur:2400,in:{grimy_starbloom:1},out:{starbloom:1}},
    {sub:'Mixing'},
    {id:'x1',n:'Attack potion',lvl:5,xp:90,dur:5200,in:{bitterleaf:1,vial:1,newt_eye:1},out:{attack_potion:1}},
    {id:'x2',n:'Strength potion',lvl:18,xp:160,dur:5200,in:{marshroot:1,vial:1,goblin_ash:1},out:{strength_potion:1}},
    {id:'x3',n:'Defence potion',lvl:32,xp:280,dur:5600,in:{emberwort:1,vial:1,goblin_ash:2},out:{defence_potion:1}},
    {id:'x4',n:'Combat potion',lvl:48,xp:480,dur:6400,in:{sunthistle:1,vial:1,troll_fat:1},out:{combat_potion:1}},
    {id:'x5',n:'Super potion',lvl:70,xp:820,dur:7200,in:{frostvein:1,starbloom:1,vial:1,wraith_dust:1},out:{super_potion:1}},
  ]},
  prayer:{n:'Prayer',acts:[
    {id:'y1',n:'Bury bones',lvl:1,xp:45,dur:2600,in:{bones:1}},
    {id:'y2',n:'Bury big bones',lvl:1,xp:150,dur:2600,in:{big_bones:1}},
  ]},
};
const CROPS=[
  {id:'bitterleaf',n:'Bitterleaf',lvl:1,seed:'seed_bitterleaf',out:'grimy_bitterleaf',ms:8*60000,plant:14,harv:35,yield:[2,4]},
  {id:'marshroot',n:'Marshroot',lvl:14,seed:'seed_marshroot',out:'grimy_marshroot',ms:14*60000,plant:28,harv:75,yield:[2,5]},
  {id:'emberwort',n:'Emberwort',lvl:28,seed:'seed_emberwort',out:'grimy_emberwort',ms:22*60000,plant:52,harv:145,yield:[3,6]},
  {id:'sunthistle',n:'Sunthistle',lvl:42,seed:'seed_sunthistle',out:'grimy_sunthistle',ms:34*60000,plant:95,harv:270,yield:[3,7]},
  {id:'frostvein',n:'Frostvein',lvl:60,seed:'seed_frostvein',out:'grimy_frostvein',ms:50*60000,plant:170,harv:500,yield:[4,8]},
  {id:'starbloom',n:'Starbloom',lvl:78,seed:'seed_starbloom',out:'grimy_starbloom',ms:75*60000,plant:300,harv:900,yield:[4,9]},
];
const BOSSES=[
  {id:'wdn',weak:'magic',n:'The Sunken Warden',boss:1,req:40,lvl:55,hp:420,max:22,spd:2600,xp:1400,gp:[900,2200],
   drop:{big_bones:2,wraith_dust:1},unique:{id:'warden_blade',c:.28}},
  {id:'tyr',weak:'ranged',n:'Molten Tyrant',boss:1,req:60,lvl:78,hp:820,max:32,spd:2400,xp:3200,gp:[2500,6000],
   drop:{big_bones:3,troll_fat:2},unique:{id:'tyrant_plate',c:.22}},
  {id:'hlk',weak:'melee',n:'The Hollow King',boss:1,req:80,lvl:99,hp:1600,max:44,spd:2200,xp:7500,gp:[7000,16000],
   drop:{shard:2,wraith_dust:3},unique:{id:'hollow_crown',c:.16}},
  /* First boss to carry more than one unique. The two refs roll independently,
     so a kill can yield both, either, or neither. */
  {id:'pro',weak:'magic',n:'The Starless Progenitor',boss:1,req:90,lvl:118,hp:2800,max:58,spd:2100,xp:15000,gp:[14000,32000],
   drop:{big_bones:5,shard:5,wraith_dust:4},
   unique:[{id:'wyrm_aegis',c:.15},{id:'starless_amulet',c:.10}],
   loot:{table:'gem_rich',c:.5}},
];
const DUNGEONS=[
  {id:'vault',n:'The Sunken Vaults',req:30,floors:5,weak:'ranged',
   tmpl:{lvl:26,hp:48,max:9,spd:2700,xp:130,gp:[40,110],drop:{bones:1,newt_eye:1}},step:.30,
   bonusXp:1000,bonusGp:1000,ring:'ring_vigour',ringC:.20,deepDmg:1.0,deepPen:.014},
  {id:'ember',n:'Emberdeep',req:50,floors:7,weak:'magic',
   tmpl:{lvl:46,hp:105,max:16,spd:2900,xp:310,gp:[130,330],drop:{big_bones:1,troll_fat:1}},step:.28,
   bonusXp:5800,bonusGp:6500,ring:'ring_warding',ringC:.17,deepDmg:.10,deepPen:.050},
  {id:'spire',n:'The Hollow Spire',req:70,floors:10,weak:'melee',
   tmpl:{lvl:68,hp:210,max:22,spd:2600,xp:700,gp:[320,820],drop:{wraith_dust:1,big_bones:2}},step:.26,
   bonusXp:30000,bonusGp:32000,ring:'ring_fortune',ringC:.14,deepDmg:.10,deepPen:.022},
];
/* Floors past d.floors are "deep" — an optional gauntlet after the clear.
   Fixed floors: level growth is deliberately gentle. The old 0.55 pushed foe
   level past the point where hit chance pins at its 0.25 floor, which is what
   made late floors take four minutes a kill and locked entry-level players out
   of the dungeon they were allowed to enter.
   Deep floors get a different SHAPE, not just bigger numbers: far fewer hit
   points than the clear floor so kills stay quick, and rising damage plus
   armour penetration so the run ends in death rather than boredom.
   Penetration is player-relative, which is what makes the risk ramp smoothly
   instead of waiting for raw damage to clear a flat armour threshold. */
/* Every way of leaving a delve ALIVE banks the haul; only dying forfeits it.
   Routing all of them through here matters because there are four: the dungeon
   button, running out of food, starting some other activity, and going offline. */
function bankDelve(why){
  if(!S.delve)return 0;
  const hg=S.delve.haulGp||0,hx=S.delve.haulXp||0;
  if(hg)gainGp(hg);
  if(hx)grantXp('slayer',hx);
  if(gains){if(hg||hx)gains.haulGp=(gains.haulGp||0)+hg;}
  else if(hg||hx)pushLog(`${why} — banked ${fmt(hg)} gp and ${fmt(hx)} slayer xp`,'task');
  S.delve=null;
  return hg;
}
function delveFoe(d,floor){
  const t=d.tmpl;
  const deep=Math.max(0,floor-d.floors+1);
  const base=Math.min(floor,d.floors-1);
  const clearM=1+(d.floors-1)*d.step;
  const m  = deep? clearM*0.30+deep*d.step*0.06 : 1+base*d.step;
  const md = 1+base*d.step*0.30+deep*d.step*(d.deepDmg||0);
  const ml = 1+base*d.step*0.24-deep*0.03;
  return{id:d.id+'#'+floor,delve:1,deep,
    n:deep?`${d.n} · depth ${deep}`:`${d.n} · floor ${floor+1}/${d.floors}`,weak:d.weak,
    lvl:Math.max(1,Math.round(t.lvl*ml)),hp:Math.max(1,Math.round(t.hp*m)),
    max:Math.round(t.max*md),spd:t.spd,pen:Math.min(.9,deep*(d.deepPen||0)),
    xp:Math.round(t.xp*m),gp:[Math.round(t.gp[0]*m),Math.round(t.gp[1]*m)],drop:t.drop};
}
const ROOMS=[
  {id:'altar',n:'Shrine',desc:t=>`+${t*15}% Prayer xp`,cost:t=>({gp:4000*t*t,oak_logs:40*t,iron_bar:15*t})},
  {id:'workshop',n:'Workshop',desc:t=>`Smithing, Crafting and Fletching ${t*7}% faster`,cost:t=>({gp:9000*t*t,willow_logs:50*t,steel_bar:20*t})},
  {id:'garden',n:'Garden',desc:t=>`+${t} farm patch${t>1?'es':''}`,cost:t=>({gp:12000*t*t,maple_logs:40*t,vial:30*t})},
  {id:'kitchen',n:'Kitchen',desc:t=>`Food heals ${t*25}% more`,cost:t=>({gp:6000*t*t,oak_logs:60*t,bronze_bar:25*t})},
  {id:'storeroom',n:'Storeroom',desc:t=>`+${t*8} bank slots`,cost:t=>({gp:15000*t*t,maple_logs:80*t,steel_bar:30*t})},
  {id:'trophy',n:'Trophy hall',desc:t=>`+${t*7}% gold from every source`,cost:t=>({gp:25000*t*t,yew_logs:50*t,cobalt_bar:20*t})},
];
const PETS={
  woodcutting:'Beaver', mining:'Rock golem', fishing:'Heron', firemaking:'Phoenix chick',
  cooking:'Ladle imp', smithing:'Forge sprite', thieving:'Shadow cat', crafting:'Loom spider',
  herblore:'Mortar toad', fletching:'Whittled owl', runecrafting:'Rift moth', prayer:'Grave lamb',
  farming:'Seedling', combat:'Baby wyrm',
};
const PET_DENOM=42000000;   // chance per action = duration_ms / this
const GE_TICK=5*60000;
const GE_SLOTS=4;
const BUYABLE=['coal','iron_ore','copper_ore','tin_ore','pine_logs','oak_logs','willow_logs',
  'feather','vial','rune_essence','bronze_bar','iron_bar','steel_bar'];
const BANK_TIERS=[40,60,80,105,135];   /* SLOTS, not item count */
const BANK_COST=[0,3000,15000,70000,300000];
const COMBAT_SKILLS=['attack','strength','defence','hitpoints','ranged','magic','slayer','farming'];
const ALL_SKILLS=[...COMBAT_SKILLS,...Object.keys(SKILLS)];

/* ============================================================
   LOOT TABLES
   ============================================================ */
/* A table is a weighted list rolled ONCE: a hit picks a single entry. That is
   what makes a table safe to share — adding an entry dilutes the others rather
   than lifting the overall drop rate, so putting `herb_mid` on a new monster
   cannot quietly inflate what the existing ones already pay out.
   w is relative weight. n is quantity: a number is fixed, [lo,hi] a range. */
const TABLES={
  herb_low:{n:'Herb table',drops:[
    {id:'grimy_bitterleaf',w:70},{id:'grimy_marshroot',w:30}]},
  herb_mid:{n:'Herb table',drops:[
    {id:'grimy_marshroot',w:55},{id:'grimy_emberwort',w:35},{id:'grimy_sunthistle',w:10}]},
  herb_high:{n:'Herb table',drops:[
    {id:'grimy_emberwort',w:40},{id:'grimy_sunthistle',w:40},{id:'grimy_frostvein',w:18},
    {table:'gem',w:2}]},
  gem:{n:'Gem table',drops:[
    {w:52},                                    // empty slots — the Ring of Fortune removes these
    {id:'uncut_sapphire',w:60},{id:'uncut_emerald',w:25},{id:'uncut_ruby',w:12},
    {table:'gem_rich',w:3}]},                  // rare promotion to the better table
  gem_rich:{n:'Rich gem table',drops:[
    {w:20},
    {id:'uncut_sapphire',w:20},{id:'uncut_emerald',w:35},{id:'uncut_ruby',w:32},{id:'uncut_diamond',w:13}]},
};
/* A table entry is one of three things:
     {id,w[,n]}   a real drop
     {table,w}    a nested roll on another table — this is how a chase item
                  sits behind two doors instead of one, the way the real game
                  chains its rare table into the gem table
     {w}          an empty slot: the table was rolled and paid out nothing
   Empty slots are entries rather than a smaller access chance on purpose. The
   Ring of Fortune removes them, and that effect is only expressible if the
   misses are things sitting on the table that can be taken off it. */
function ringWealth(){const r=S.equip&&S.equip.ring;return !!(r&&EQ[r]&&EQ[r].wealth);}
function tableDrops(name){
  const t=TABLES[name];if(!t)return [];
  return ringWealth()?t.drops.filter(e=>e.id||e.table):t.drops;
}
function refLabel(ref){return ref.table?(TABLES[ref.table]||{n:'?'}).n:item(ref.id).n;}
function pickWeighted(list){
  let tot=0;for(const e of list)tot+=(e.w||1);
  let r=Math.random()*tot;
  for(const e of list){r-=(e.w||1);if(r<0)return e;}
  return list[list.length-1]||null;
}
function rollQty(e){
  if(e.n===undefined)return 1;
  return Array.isArray(e.n)?e.n[0]+Math.floor(Math.random()*(e.n[1]-e.n[0]+1)):e.n;
}
function rollTableOnce(name,depth){
  if(depth>4)return null;                       // guard against a table cycle
  const list=tableDrops(name);if(!list.length)return null;
  const e=pickWeighted(list);if(!e)return null;
  if(e.table)return rollTableOnce(e.table,depth+1);
  return e.id?{id:e.id,qty:rollQty(e)}:null;    // no id and no table means empty
}
/* Roll one ref or a list of them. Each rolls independently at its own chance;
   a hit resolves a single outcome, which may be nothing. Returns [{id,qty}]
   and banks nothing, so callers keep control of logging and awarding. */
function rollLoot(refs){
  const out=[];
  for(const ref of [].concat(refs||[])){
    if(!ref)continue;
    if(Math.random()>=(ref.c===undefined?1:ref.c))continue;
    const d=ref.table?rollTableOnce(ref.table,0):(ref.id?{id:ref.id,qty:rollQty(ref)}:null);
    if(d)out.push(d);
  }
  return out;
}

const FOES=[
  {id:'rat',weak:'melee',n:'Giant rat',lvl:2,hp:8,max:2,spd:3000,xp:14,gp:[1,4],drop:{bones:1,newt_eye:1},
   loot:{table:'herb_low',c:.03}},
  {id:'gob',weak:'ranged',n:'Goblin',lvl:8,hp:18,max:4,spd:2900,xp:36,gp:[5,18],drop:{bones:1,goblin_ash:1},
   loot:{table:'herb_low',c:.05}},
  {id:'ban',weak:'magic',n:'Bandit',lvl:18,hp:34,max:7,spd:2800,xp:80,gp:[25,70],drop:{bones:1},
   loot:{table:'herb_low',c:.05}},
  {id:'wlf',weak:'ranged',n:'Dire wolf',lvl:30,hp:56,max:10,spd:2500,xp:150,gp:[50,120],drop:{pelt:1,bones:1},
   loot:{table:'herb_mid',c:.09}},
  {id:'gst',weak:'melee',n:'Bog ghast',lvl:39,hp:80,max:13,spd:2800,xp:230,gp:[80,200],drop:{bones:2,newt_eye:2},
   loot:{table:'herb_mid',c:.08}},
  {id:'trl',weak:'magic',n:'Cave troll',lvl:48,hp:110,max:16,spd:3200,xp:320,gp:[120,300],drop:{big_bones:1,troll_fat:1},
   loot:{table:'herb_mid',c:.105}},
  {id:'shd',weak:'magic',n:'Ember shade',lvl:60,hp:150,max:20,spd:2600,xp:470,gp:[200,480],drop:{big_bones:1,goblin_ash:2},
   loot:{table:'herb_high',c:.09}},
  {id:'wra',weak:'ranged',n:'Cairn wraith',lvl:70,hp:190,max:24,spd:2700,xp:640,gp:[280,700],drop:{shard:1,big_bones:1,wraith_dust:1},
   loot:{table:'herb_high',c:.105}},
  {id:'rev',weak:'melee',n:'Void revenant',lvl:82,hp:240,max:28,spd:2800,xp:860,gp:[420,980],drop:{shard:2,big_bones:2},
   loot:{table:'herb_high',c:.11}},
  {id:'wyr',weak:'magic',n:'Starless wyrm',lvl:92,hp:290,max:31,spd:2700,xp:1090,gp:[560,1250],drop:{shard:3,big_bones:3,wraith_dust:2},
   loot:[{table:'herb_high',c:.12},{table:'gem_rich',c:.03}]},
];

const STOCK=[
  {id:'vial',cost:20},{id:'feather',cost:6},{id:'seed_bitterleaf',cost:60},{id:'seed_marshroot',cost:180},
  {id:'seed_emberwort',cost:440},{id:'seed_sunthistle',cost:1040},
  {id:'seed_frostvein',cost:2400},{id:'seed_starbloom',cost:5600},
];
const TOOLS={
  axe:[{n:'Stone axe',mul:1,cost:0},{n:'Iron axe',mul:.85,cost:400},{n:'Steel axe',mul:.72,cost:2200},{n:'Cobalt axe',mul:.6,cost:11000},{n:'Starsteel axe',mul:.5,cost:60000}],
  pick:[{n:'Stone pick',mul:1,cost:0},{n:'Iron pick',mul:.85,cost:400},{n:'Steel pick',mul:.72,cost:2200},{n:'Cobalt pick',mul:.6,cost:11000},{n:'Starsteel pick',mul:.5,cost:60000}],
  rod:[{n:'Reed rod',mul:1,cost:0},{n:'Oak rod',mul:.85,cost:400},{n:'Barbed rod',mul:.72,cost:2200},{n:'Runed rod',mul:.6,cost:11000},{n:'Leviathan rod',mul:.5,cost:60000}],
};

/* ============================================================
   QUESTS
   ============================================================ */
const QUESTS=[
  {id:'q1',n:"The Baker's Errand",blurb:'The baker wants firewood and a hot meal.',
   need:{items:{pine_logs:10,trout:1}},reward:{xp:{cooking:400,firemaking:300},gp:250}},
  {id:'q2',n:'Rat Problem',blurb:'Something is in the grain store.',
   need:{kills:{rat:15}},reward:{xp:{attack:500,strength:500},items:{bronze_sword:1}}},
  {id:'q3',n:'The Lost Pickaxe',blurb:'A miner dropped his tools down the shaft.',
   need:{items:{iron_ore:30},lvl:{mining:20}},reward:{xp:{mining:1200},gp:800}},
  {id:'q4',n:'Goblin Diplomacy',blurb:'Two goblin camps, one very thin peace.',
   need:{kills:{gob:25},items:{silk:2}},reward:{xp:{thieving:900,defence:600},gp:1200}},
  {id:'q5',n:'The Tanner’s Debt',blurb:'Wolves took the tanner’s stock. Take it back.',
   need:{kills:{wlf:12},items:{leather:5}},reward:{xp:{crafting:2500},items:{emerald:2}}},
  {id:'q6',n:'Rites of the Cairn',blurb:'The old rites need bones and a steady hand.',
   need:{lvl:{prayer:30},items:{big_bones:20}},reward:{xp:{prayer:5000},gp:4000}},
  {id:'q7',n:'The Hollow Crown',blurb:'Six shards, one crown, one very bad idea.',
   need:{items:{shard:6},lvl:{attack:60,defence:60}},reward:{xp:{attack:12000,strength:12000,defence:12000},items:{diamond_amulet:1},gp:25000}},
];

