const SCEN = __CONTENT__;
const OX = __OXFORD__;
const OXTR = __OXTR__;   // Turkish gloss per Oxford word, same order as OX

/* Offline glossary for the word rescue when Claude is unavailable */
const GLOSS = __GLOSS__;

const CATS = [["work","İş iletişimi"],["tech","Teknik toplantılar"],["budget","Bütçe ve takvim"],["social","Sosyal sohbet"],["all","Tümü"]];
const LEVELS = {
  1:{name:"Temel", note:"Kısa, basit cümleler. Önce ritmi ve temel kalıpları otur.", pace:"90,60,45",
     style:"Use very short, simple sentences (max 10-12 words), everyday words, present and simple past tense. Ask one simple question at a time. The recast should also be short and simple, only fixing what blocks natural meaning."},
  2:{name:"Orta", note:"Bağlaçlı, iki parçalı cümleler ve rakamlar.", pace:"120,90,60",
     style:"Use clear, moderately simple business English: sentences of up to about 18 words, common linking words (because, so, but, if). Recast into natural but not advanced English."},
  3:{name:"İleri", note:"Toplantıdaki doğal uzunlukta, teknik ve nüanslı cümleler.", pace:"240,180,120",
     style:"Speak naturally like a senior colleague in a real meeting, with idiomatic business English and precise technical vocabulary. Recast into fluent, native-like engineering English."}
};
const PASS = 77;          // % of native speed needed for a line to count
const GRACE = 0.7;        // seconds of reaction time not counted against the speaker
const GAPS = [0,1,2,4,7,15,30]; // days before a word is due again, by number of days it was met
const SETTLED = 4;        // met on this many different days = settled

const $ = s => document.querySelector(s);
/* progress lives in memory + localStorage, and is mirrored to the viewer's private account record (see "account sync") */
const MEM = {};
const SYNC_KEYS = ["lt.cat","lt.scen","lt.level","lt.unlocked","lt.prog","lt.seen","lt.mine","lt.stats","lt.where","lt.done","lt.reach","lt.howto"];
const store = {
  get(k,d){if(k in MEM) return MEM[k]; try{const v=localStorage.getItem(k);return v?(MEM[k]=JSON.parse(v)):d}catch{return d}},
  put(k,v){MEM[k]=v; try{localStorage.setItem(k,JSON.stringify(v))}catch{}},
  set(k,v){store.put(k,v); if(SYNC_KEYS.includes(k)){store.put("lt.updatedAt",Date.now()); scheduleSync()}}
};
let cat = store.get("lt.cat","work");
let cur = SCEN.find(s=>s.id===store.get("lt.scen","standup")) || SCEN.find(s=>s.cat===cat) || SCEN[0];
let unlocked = Math.min(3, Math.max(1, +store.get("lt.unlocked",1)||1));
let level = Math.min(unlocked, +store.get("lt.level",1)||1);
const L = () => cur.levels[level];
// levels 2 and 3 are later episodes of the topic's story, each with its own title, situation and partner
const eT = (x,lv=level) => x.levels[lv]?.title || x.title;
const bf = () => L().brief || cur.brief;
const rl = () => L().role || cur.role;
const clean = t => t.replace(/…/g,"").trim();
const opener = () => (L().lines.find(x=>x.s==="t")||{en:"Shall we start?"}).en;

/* ---------- word memory: Oxford 3000 words met, spaced by days ---------- */
const today = () => Math.floor(Date.now()/864e5);
let SEEN = store.get("lt.seen",{});          // idx -> [days met, last day]
const IN_CONTENT = new Set(SCEN.flatMap(s=>Object.values(s.levels).flatMap(l=>l.lines.flatMap(x=>x.w))));
const OXI = new Map(OX.map((w,i)=>[w,i]));
function meet(idxs){
  const d=today(); let changed=false;
  idxs.forEach(i=>{const e=SEEN[i]; if(!e){SEEN[i]=[1,d];changed=true} else if(e[1]!==d){e[0]++;e[1]=d;changed=true}});
  if(changed){store.set("lt.seen",SEEN);renderMemory()}
}
function isDue(i){const e=SEEN[i]; if(!e) return false; return e[0]<SETTLED+2 && today()-e[1]>=GAPS[Math.min(e[0],GAPS.length-1)]}
function dueWords(n){
  return Object.keys(SEEN).map(Number).filter(isDue)
    .sort((a,b)=>(today()-SEEN[b][1])-(today()-SEEN[a][1])).slice(0,n);
}
function newWords(n){
  // prefer words the dialogues never use, so the partner widens coverage
  const pool=OX.map((_,i)=>i).filter(i=>!SEEN[i]&&!IN_CONTENT.has(i)&&OX[i].length>2);
  const out=[]; const seed=today();
  for(let k=0;k<pool.length&&out.length<n;k++){out.push(pool[(seed*97+k*389)%pool.length])}
  return [...new Set(out)];
}
/* rough English lemmatiser for free text (partner replies) */
const IRR={was:"be",were:"be",is:"be",are:"be",been:"be",has:"have",had:"have",did:"do",does:"do",done:"do",went:"go",gone:"go",made:"make",took:"take",taken:"take",gave:"give",given:"give",got:"get",came:"come",saw:"see",seen:"see",knew:"know",known:"know",thought:"think",told:"tell",said:"say",found:"find",felt:"feel",left:"leave",kept:"keep",brought:"bring",bought:"buy",built:"build",sent:"send",spent:"spend",paid:"pay",met:"meet",ran:"run",began:"begin",begun:"begin",broke:"break",chose:"choose",drove:"drive",ate:"eat",fell:"fall",flew:"fly",grew:"grow",heard:"hear",held:"hold",led:"lead",lost:"lose",meant:"mean",sat:"sit",slept:"sleep",sold:"sell",spoke:"speak",stood:"stand",taught:"teach",understood:"understand",won:"win",wrote:"write",written:"write",children:"child",men:"man",women:"woman",feet:"foot",teeth:"tooth",lives:"life",better:"good",best:"good",worse:"bad",worst:"bad"};
const SUF=[["ies","y"],["ied","y"],["ier","y"],["iest","y"],["es",""],["s",""],["ed",""],["ed","e"],["d",""],["ing",""],["ing","e"],["er",""],["er","e"],["est",""],["ly",""]];
function oxIn(text){
  const out=new Set(), low=text.toLowerCase().replace(/’/g,"'");
  (low.match(/[a-z]+(?:-[a-z]+)?/g)||[]).forEach(t=>{
    if(OXI.has(t)){out.add(OXI.get(t));return}
    if(IRR[t]&&OXI.has(IRR[t])){out.add(OXI.get(IRR[t]));return}
    for(const [s,r] of SUF){ if(t.endsWith(s)&&t.length-s.length>=2){let b=t.slice(0,-s.length)+r; if(OXI.has(b)){out.add(OXI.get(b));return}
      if(b.length>2&&b.at(-1)===b.at(-2)&&OXI.has(b.slice(0,-1))){out.add(OXI.get(b.slice(0,-1)));return}}}
  });
  return [...out];
}
function renderMemory(){
  const met=Object.keys(SEEN).length, settled=Object.values(SEEN).filter(e=>e[0]>=SETTLED).length;
  $("#memMet").textContent=met; $("#memSettled").textContent=settled;
  $("#memBarMet").style.width=(met/OX.length*100)+"%"; $("#memBarSettled").style.width=(settled/OX.length*100)+"%";
  $("#memDue").textContent=dueWords(999).length;
  if(memOpen) renderMemList();
}
/* tapping a figure lists its words with the Turkish meaning and a sentence from the dialogues */
let memOpen=null, EXAMPLE=null;
function exampleFor(i){
  if(!EXAMPLE){EXAMPLE={}; SCEN.forEach(s=>Object.values(s.levels).forEach(l=>l.lines.forEach(x=>(x.w||[]).forEach(w=>{if(!(w in EXAMPLE)) EXAMPLE[w]=x.en}))))}
  return EXAMPLE[i]||"";
}
function renderMemList(){
  const box=$("#memList"), d=today();
  document.querySelectorAll(".mem-fig").forEach(b=>b.setAttribute("aria-expanded",String(b.dataset.k===memOpen)));
  if(!memOpen){box.hidden=true;return}
  let ids=Object.keys(SEEN).map(Number), title;
  if(memOpen==="met"){ids.sort((a,b)=>SEEN[b][1]-SEEN[a][1]||SEEN[b][0]-SEEN[a][0]); title="Karşılaştığın kelimeler (en son görülen önce)"}
  else if(memOpen==="settled"){ids=ids.filter(i=>SEEN[i][0]>=SETTLED).sort((a,b)=>OX[a].localeCompare(OX[b])); title="Pekişen kelimeler"}
  else {ids=dueWords(9999); title="Tekrar zamanı gelen kelimeler (en çok bekleyen önce)"}
  const ago=n=>n===0?"bugün":n===1?"dün":n+" gün önce";
  box.innerHTML=`<div class="mem-list-head"><b>${title}</b><span class="muted">${ids.length} kelime</span><button class="mini" id="memClose">Kapat</button></div>`;
  if(!ids.length){box.insertAdjacentHTML("beforeend",`<p class="muted">${memOpen==="due"?"Şu an tekrar zamanı gelen kelime yok.":memOpen==="settled"?"Henüz pekişen kelime yok. Bir kelime farklı günlerde 4 kez karşına çıkınca buraya gelir.":"Henüz kelime yok. Bir diyalog dinleyince burası dolmaya başlar."}</p>`)}
  const ul=document.createElement("ul"); ul.className="mem-words";
  ids.slice(0,400).forEach(i=>{const e=SEEN[i]; const li=document.createElement("li");
    li.innerHTML=`<span class="mw-en"></span><span class="mw-tr"></span><span class="mw-meta" title="Farklı günlerde kaç kez karşına çıktı · en son ne zaman">${e[0]} kez · ${ago(d-e[1])}</span>`;
    li.querySelector(".mw-en").textContent=OX[i]; li.querySelector(".mw-tr").textContent=OXTR[i]||"";
    const ex=exampleFor(i); if(ex){const q=document.createElement("span"); q.className="mw-ex"; q.textContent=ex; li.append(q, listenBtn(ex,"y"))}
    ul.append(li)});
  box.append(ul);
  if(ids.length>400) box.insertAdjacentHTML("beforeend",`<p class="muted">İlk 400 kelime gösteriliyor.</p>`);
  $("#memClose").onclick=()=>{memOpen=null;renderMemList()};
  box.hidden=false;
}
document.querySelectorAll(".mem-fig").forEach(b=>b.onclick=()=>{memOpen=memOpen===b.dataset.k?null:b.dataset.k; renderMemList(); if(memOpen) $("#memList").scrollIntoView({behavior:"smooth",block:"nearest"})});

/* ---------- audio: recorded clips first, browser voice as fallback ---------- */
function key(t){let h=5381;for(let i=0;i<t.length;i++)h=((h*33)^t.charCodeAt(i))>>>0;return h.toString(16)}
let CLIPS={}, DUR={};
const loaded={};
function loadAudio(id){
  if(!loaded[id]) loaded[id]=fetch("audio/"+id+".json").then(r=>r.ok?r.json():null).then(j=>{if(j){Object.assign(CLIPS,j.clips||{});Object.assign(DUR,j.dur||{})}}).catch(()=>{});
  return loaded[id];
}
loadAudio("common");
const player = new Audio();
let playToken = 0, pendingRes=null;
const hasTts = "speechSynthesis" in window;
let voice=null, ttsWorks=null;
function pickVoice(){
  if(!hasTts) return;
  const vs=speechSynthesis.getVoices().filter(v=>/^en[-_]/i.test(v.lang));
  voice = vs.find(v=>/natural|neural|google|samantha|daniel|serena/i.test(v.name)&&/GB|US/i.test(v.lang)) || vs.find(v=>/en[-_](GB|US)/i.test(v.lang)) || vs[0] || null;
}
if(hasTts){pickVoice(); try{speechSynthesis.onvoiceschanged=pickVoice}catch{}}
function stopAudio(){playToken++; try{player.pause()}catch{} if(hasTts) try{speechSynthesis.cancel()}catch{}
  if(pendingRes){const r=pendingRes;pendingRes=null;r(null)}}
function rate(){return +$("#rate").value}
/* play(text, speaker) resolves with the clip's native duration in seconds once playback ends */
function play(text,sp="y"){
  stopAudio(); const my=playToken; const k=key(sp+"|"+text);
  return new Promise(async res0=>{
    const res=v=>{if(pendingRes===res){pendingRes=null}res0(v)}; pendingRes=res;
    await Promise.all([loadAudio(cur.id),loadAudio("common")]);
    if(my!==playToken) return res(null);
    if(CLIPS[k]){
      player.src=CLIPS[k]; player.playbackRate=rate(); try{player.preservesPitch=true}catch{}
      player.onended=()=>res(my===playToken?DUR[k]:null);
      player.onerror=()=>res(null);
      player.play().catch(()=>res(null));
      return;
    }
    const url=await neural(text);
    if(my!==playToken) return res(null);
    if(url){
      player.src=url; player.playbackRate=rate(); try{player.preservesPitch=true}catch{}
      player.onended=()=>res(my===playToken?(player.duration||1):null);
      player.onerror=()=>res(null);
      player.play().catch(()=>res(null));
      return;
    }
    speakTts(text,()=>res(my===playToken?Math.max(1,text.split(/\s+/).length/2.6):null));
  });
}
/* ---------- in-page neural voice (Piper via onnxruntime-web) for text with no recorded clip ---------- */
const NEU={state:"idle",p:null,cache:new Map()};
function neuStatus(t){const e=$("#neuNote"); if(!e) return; e.hidden=!t; e.textContent=t||""}
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
function warmNeural(){
  if(NEU.p) return NEU.p;
  NEU.state="loading"; neuStatus("Ses motoru yükleniyor… (ilk seferde ~30 MB, sonra hazır)");
  NEU.p=(async()=>{
    const [cfg,parts]=await Promise.all([
      fetch("tts/voice.json").then(r=>r.json()),
      Promise.all([0,1].map(i=>fetch("tts/voice"+i+".wasm").then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()}))),
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/ort.min.js")
    ]).then(([c,p])=>[c,p]);
    let ph;
    try{ph=await import("https://cdn.jsdelivr.net/npm/phonemizer@1.2.1/dist/phonemizer.js")}
    catch{ph=await import(new URL("tts/phonemizer.js",location.href).href)}
    const ort=window.ort;
    ort.env.wasm.wasmPaths=new URL("ort/",location.href).href;
    ort.env.wasm.numThreads=1; ort.env.wasm.proxy=false;
    const all=new Uint8Array(parts.reduce((n,b)=>n+b.byteLength,0)); let o=0;
    for(const b of parts){all.set(new Uint8Array(b),o);o+=b.byteLength}
    const sess=await ort.InferenceSession.create(all,{executionProviders:["wasm"]});
    NEU.ort=ort; NEU.sess=sess; NEU.cfg=cfg; NEU.phonemize=ph.phonemize; NEU.state="ready"; neuStatus("");
  })().catch(e=>{console.warn("neural tts",e);NEU.state="failed";neuStatus("");return null});
  return NEU.p;
}
async function neuSentence(piece,term){
  const {cfg,ort,sess}=NEU, map=cfg.phoneme_id_map;
  const ph=(await NEU.phonemize(piece,"en-us")).join(" ")+term;
  const ids=[...map["^"],...map["_"]];
  for(const c of ph.normalize("NFD")){if(map[c]){ids.push(...map[c],...map["_"])}}
  ids.push(...map["$"]);
  const inf=cfg.inference;
  const out=await sess.run({
    input:new ort.Tensor("int64",BigInt64Array.from(ids.map(BigInt)),[1,ids.length]),
    input_lengths:new ort.Tensor("int64",BigInt64Array.from([BigInt(ids.length)]),[1]),
    scales:new ort.Tensor("float32",Float32Array.from([inf.noise_scale,inf.length_scale,inf.noise_w]),[3])
  });
  return out[Object.keys(out)[0]].data;
}
function wavUrl(chunks,sr){
  const n=chunks.reduce((a,c)=>a+c.length,0), buf=new ArrayBuffer(44+n*2), v=new DataView(buf);
  const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  w(0,"RIFF");v.setUint32(4,36+n*2,true);w(8,"WAVE");w(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,"data");v.setUint32(40,n*2,true);
  let peak=0.01; for(const c of chunks)for(const x of c)peak=Math.max(peak,Math.abs(x));
  const g=Math.min(1,0.9/peak)*32767; let o=44;
  for(const c of chunks)for(const x of c){v.setInt16(o,Math.max(-32768,Math.min(32767,x*g)),true);o+=2}
  return URL.createObjectURL(new Blob([buf],{type:"audio/wav"}));
}
async function neural(text){
  text=(text||"").trim(); if(!text) return null;
  if(NEU.cache.has(text)) return NEU.cache.get(text);
  await warmNeural(); if(NEU.state!=="ready") return null;
  const sr=NEU.cfg.audio.sample_rate, gap=new Float32Array(Math.round(sr*0.25)), chunks=[];
  const re=/[^.,!?;:]+[.,!?;:]*/g; let m;
  try{
    while((m=re.exec(text))){
      const raw=m[0].trim(); if(!/[a-z0-9]/i.test(raw)) continue;
      const term=(raw.match(/[.,!?;:]+$/)||["."])[0].slice(-1), piece=raw.replace(/[.,!?;:]+$/,"");
      chunks.push(await neuSentence(piece,term===","||term===";"||term===":"?term+" ":term));
      if(/[.!?]/.test(term)) chunks.push(gap);
    }
  }catch(e){console.warn("neural synth",e);return null}
  if(!chunks.length) return null;
  const url=wavUrl(chunks,sr); NEU.cache.set(text,url); return url;
}
function speakTts(text,onend){
  if(!hasTts){ttsBroken();onend&&onend();return}
  const u=new SpeechSynthesisUtterance(text);
  if(voice) u.voice=voice; u.lang=voice?.lang||"en-US"; u.rate=rate();
  let started=false;
  u.onstart=()=>{started=true;ttsWorks=true};
  u.onend=()=>onend&&onend(); u.onerror=()=>{onend&&onend()};
  // Chrome drops a speak() issued in the same tick as cancel()
  setTimeout(()=>{try{speechSynthesis.speak(u)}catch{onend&&onend()}},60);
  setTimeout(()=>{if(!started&&ttsWorks!==true){ttsBroken();try{speechSynthesis.cancel()}catch{};onend&&onend()}},2500);
}
function ttsBroken(){ttsWorks=false;$("#ttsNote").hidden=false}
$("#rate").oninput=e=>{$("#rateVal").textContent=(+e.target.value).toFixed(2)+"×";player.playbackRate=+e.target.value};
$("#stopTts").onclick=()=>{stopAudio();mark(-1)};

/* ---------- levels ---------- */
function progKey(id,lv,i){return `${id}:${lv}:${i}`}
function dialogDone(s,lv){const p=store.get("lt.prog",{});return s.levels[lv].lines.every((_,i)=>(p[progKey(s.id,lv,i)]||0)>=PASS)}
/* ---------- learning path: one topic at a time, tabs open in order, social talk interleaved ----------
   Work, technical and budget topics follow each other tab by tab; one social topic comes after every two of them.
   A topic is complete when its dialogue, 4/3/2 and meeting are all done at that level. The next topic opens only then.
   When the whole path is complete the next level opens and the path starts again from the first topic (spiral). */
const STAGES=["work","tech","budget"];
const PATH=(()=>{const main=STAGES.flatMap(c=>SCEN.filter(x=>x.cat===c)), soc=SCEN.filter(x=>x.cat==="social"), out=[]; let j=0;
  main.forEach((x,i)=>{out.push(x); if(i%2===1&&j<soc.length) out.push(soc[j++])}); while(j<soc.length) out.push(soc[j++]); return out})();
const STAGE_OF={}; {let st=STAGES[0]; PATH.forEach(x=>{if(STAGES.includes(x.cat)) st=x.cat; STAGE_OF[x.id]=st})}
const PIDX=new Map(PATH.map((x,i)=>[x.id,i]));
const tkey=(s,lv)=>s.id+":"+lv;
function tasks(s,lv){const d=store.get("lt.done",{})[tkey(s,lv)]||{}; return {d:dialogDone(s,lv), r:!!d.r, m:!!d.m}}
function topicDone(s,lv){const t=tasks(s,lv); return t.d&&t.r&&t.m}
function firstOpen(lv){const k=PATH.findIndex(x=>!topicDone(x,lv)); return k<0?PATH.length-1:k}
function reachOf(lv){const k=PATH.findIndex(x=>!topicDone(x,lv)); return Math.max(k<0?PATH.length-1:k, +(store.get("lt.reach",{})[lv]||0))}
function isOpen(s,lv){return PIDX.get(s.id)<=reachOf(lv)}
function doneCount(lv){return PATH.filter(x=>topicDone(x,lv)).length}
function missing(s,lv){const t=tasks(s,lv), m=[]; if(!t.d) m.push("diyalog"); if(!t.r) m.push("4/3/2"); if(!t.m) m.push("toplantı"); return m}
function joinTr(a){return a.length<2?a.join(""):a.slice(0,-1).join(", ")+" ve "+a.at(-1)}
function markTask(f){
  const all=store.get("lt.done",{}), k=tkey(cur,level), e=all[k]=all[k]||{}; if(e[f]) return; e[f]=1; store.set("lt.done",all);
  afterProgress();
}
function afterProgress(){
  renderScenList(); renderCats(); renderLevels();
  if(topicDone(cur,level)&&!afterProgress.seen.has(tkey(cur,level))){
    afterProgress.seen.add(tkey(cur,level));
    const nx=PATH.find(x=>!topicDone(x,level));
    const b=$("#banner"); b.textContent=nx?`"${eT(cur)}" tamamlandı. Sıradaki konu açıldı: ${eT(nx)}.`:`Bu seviyedeki tüm konular tamamlandı.`; b.hidden=false; setTimeout(()=>{b.hidden=true},9000);
  }
  if(level===unlocked&&unlocked<3&&doneCount(level)===PATH.length) setTimeout(unlockNext,900);
}
afterProgress.seen=new Set();
// a stored topic that is not open at this level falls back to the next topic on the path
function ensureOpen(){ if(!isOpen(cur,level)){cur=PATH[firstOpen(level)]; store.set("lt.scen",cur.id)} }
function lineDone(){const p=store.get("lt.prog",{});return L().lines.filter((_,i)=>(p[progKey(cur.id,level,i)]||0)>=PASS).length}
function renderLevels(){
  const row=$("#levelRow"); row.innerHTML="";
  [1,2,3].forEach(n=>{
    const b=document.createElement("button"); b.className="lvl"; b.id="lvl-"+n;
    b.setAttribute("aria-pressed", n===level); b.disabled = n>unlocked;
    const t=document.createElement("strong"); t.textContent=n+" · "+LEVELS[n].name;
    const s=document.createElement("small"); s.textContent = n>unlocked ? (n===unlocked+1?`Kilitli · ${unlocked}. seviyedeki ${PATH.length} konu bitince açılır`:`Kilitli · ${n-1}. seviye bitince açılır`) : LEVELS[n].note;
    if(n>unlocked) b.classList.add("locked");
    b.append(t,s);
    b.onclick=()=>{level=n;store.set("lt.level",n);ensureOpen();renderAll();resetMeeting()};
    row.append(b);
  });
  const dc=doneCount(level);
  $("#lvlProgress").textContent = (level<unlocked||level===3)
    ? `Bu seviyede ${dc}/${PATH.length} konu tamamlandı.`
    : `${level+1}. seviye için: ${dc}/${PATH.length} konu tamamlandı (her konuda diyalog, 4/3/2 ve toplantı).`;
  $("#skipLvl").hidden = level!==unlocked || unlocked>=3;
}
function unlockNext(){
  if(unlocked>=3) return;
  unlocked++; store.set("lt.unlocked",unlocked);
  level=unlocked; store.set("lt.level",level);
  ensureOpen(); renderAll(); resetMeeting();
  const b=$("#banner"); b.textContent=`Seviye ${level} · ${LEVELS[level].name} açıldı. Diyaloglar biraz daha uzun ve toplantı partneri de daha doğal konuşacak.`; b.hidden=false;
  setTimeout(()=>{b.hidden=true},9000);
}
$("#skipLvl").onclick=unlockNext;

/* ---------- scenarios ---------- */
function renderCats(){
  const row=$("#catRow"); row.innerHTML="";
  CATS.forEach(([id,name])=>{
    const n=tabList(id).length, open=tabOpen(id);
    const b=document.createElement("button"); b.className="cat"+(open?"":" locked"); b.id="cat-"+id; b.setAttribute("aria-pressed",id===cat);
    b.textContent=`${open?"":"🔒 "}${name} · ${n}`;
    b.onclick=()=>{cat=id;store.set("lt.cat",id);renderCats();renderScenList(); if(!open) lockNote(`🔒 ${name} sekmesi henüz kilitli. Önceki sekmedeki konular bitince açılır. İstersen o sekmede "Bu sekme kolay, sonrakini aç"a basabilirsin.`)};
    row.append(b);
  });
}
// a stage tab lists its own topics with the social topics that fall between them, in path order
function tabList(id){return id==="all"?PATH:id==="social"?PATH.filter(x=>x.cat==="social"):PATH.filter(x=>STAGE_OF[x.id]===id)}
function tabOpen(id){return id==="all"||tabList(id).some(x=>isOpen(x,level))}
function lockNote(t){const n=$("#lockMsg"); n.textContent=t; n.hidden=false; clearTimeout(lockNote.t); lockNote.t=setTimeout(()=>{n.hidden=true},8000)}
function goTopic(s){cur=s;store.set("lt.scen",s.id);loadAudio(s.id);renderAll();resetMeeting()}
function renderScenList(){
  const row=$("#scenRow"); row.innerHTML="";
  // next topic: the first unfinished open one in this tab (after a tab skip), otherwise the first unfinished on the path
  const allDone=doneCount(level)===PATH.length, nx=tabList(cat).find(x=>isOpen(x,level)&&!topicDone(x,level))||PATH[firstOpen(level)];
  tabList(cat).forEach(s=>{
    const open=isOpen(s,level), done=topicDone(s,level);
    const b=document.createElement("button"); b.className="scen"+(open?"":" locked"); b.id="scen-"+s.id;
    b.setAttribute("aria-pressed", s===cur);
    const tag=document.createElement("span"); tag.className="tag"; tag.textContent=(s.cat==="social"&&cat!=="social"?"SOHBET · ":"")+s.tag+(level>1&&s.levels[level]?.title?` · ${level}. BÖLÜM`:"");
    const st=document.createElement("strong"); st.textContent=(open?"":"🔒 ")+eT(s);
    b.append(tag,st);
    if(open){const t=tasks(s,level), d=document.createElement("div"); d.className="tasks";
      [["Diyalog",t.d],["4/3/2",t.r],["Toplantı",t.m]].forEach(([n,o])=>{const x=document.createElement("span");x.className=o?"ok":"";x.textContent=(o?"✓ ":"○ ")+n;d.append(x)}); b.append(d)}
    if(done){const m=document.createElement("span");m.className="badge ok";m.textContent="✓ tamamlandı";b.append(m)}
    else if(open&&s===cur){const m=document.createElement("span");m.className="badge";m.textContent="Şu an burada";b.append(m)}
    else if(open){const m=document.createElement("span");m.className="badge";m.textContent="Açık";b.append(m)}
    b.onclick=()=>{
      if(!open){lockNote(`🔒 "${eT(s)}" henüz kilitli. Önce "${eT(nx)}" konusunu bitir: ${joinTr(missing(nx,level))} eksik.`);return}
      $("#lockMsg").hidden=true; goTopic(s); $("#brief").scrollIntoView({behavior:"smooth",block:"start"})};
    row.append(b);
  });
  const n=$("#suggest"); n.textContent=""; n.hidden=allDone;
  if(!allDone){const a=document.createElement("button"); a.className="linkish";
    a.textContent=nx===cur?`Şu anki konu: ${eT(nx)} · eksik: ${joinTr(missing(nx,level))}`:`Sıradaki konu: ${eT(nx)} · eksik: ${joinTr(missing(nx,level))}`;
    a.onclick=()=>{cat=STAGE_OF[nx.id];store.set("lt.cat",cat);goTopic(nx);$("#brief").scrollIntoView({behavior:"smooth",block:"start"})};
    n.append(a)}
  // "this tab is easy": opens the next tab at this level without finishing the current one
  const sk=$("#skipTab"), stI=STAGES.indexOf(cat), nextStage=STAGES[stI+1];
  const canSkip=stI>=0&&nextStage&&tabOpen(cat)&&!tabOpen(nextStage);
  sk.hidden=!canSkip;
  if(canSkip) sk.onclick=()=>{const r=store.get("lt.reach",{}); r[level]=Math.max(+(r[level]||0),PIDX.get(tabList(nextStage)[0].id)); store.set("lt.reach",r);
    cat=nextStage; store.set("lt.cat",cat); renderCats(); renderScenList();
    const b=$("#banner"); b.textContent=`${CATS.find(c=>c[0]===nextStage)[1]} sekmesi açıldı.`; b.hidden=false; setTimeout(()=>{b.hidden=true},6000)};
}
function renderBrief(){
  $("#briefTxt").textContent=bf(); $("#briefRole").textContent=rl();
  const kit=$("#kit"); kit.innerHTML="";
  L().chunks.forEach(([en,tr])=>{
    const c=document.createElement("button"); c.className="chunk";
    c.textContent=en; const sm=document.createElement("small"); sm.textContent=tr; c.append(sm);
    c.onclick=()=>{play(clean(en),"y");meet(oxIn(en))};
    kit.append(c);
  });
}

/* ---------- 4/3/2 speaking plan: how to open, what order to tell it in, how to close ---------- */
const FRAMES={
 1:{open:[["Let me tell you about…","Size … anlatayım"],["Today I want to talk about…","Bugün … hakkında konuşmak istiyorum"],["The main point is…","Ana konu şu…"]],
    go:[["First,…","Önce…"],["Then…","Sonra…"],["because…","çünkü…"],["So…","Bu yüzden…"],["The problem is…","Sorun şu…"]],
    close:[["So, the next step is…","Yani sıradaki adım…"],["That's all from me.","Benden bu kadar."],["Any questions?","Sorusu olan var mı?"]]},
 2:{open:[["I'd like to give you a quick update on…","… hakkında kısa bir bilgi vermek istiyorum"],["Let me start with the main point.","Ana noktayla başlayayım."],["The short version is…","Kısacası…"]],
    go:[["The reason is that…","Sebebi şu…"],["As a result,…","Sonuç olarak…"],["On top of that,…","Üstelik…"],["What we're doing now is…","Şu an yaptığımız şey…"],["Let me give you an example.","Bir örnek vereyim."]],
    close:[["To sum up,…","Özetle…"],["The next step is…","Sıradaki adım…"],["Does that make sense?","Anlaşılır mı?"]]},
 3:{open:[["Let me walk you through…","Size … adım adım anlatayım"],["I'll keep this brief.","Kısa tutacağım."],["The headline is…","Ana mesaj şu…"]],
    go:[["The root cause turned out to be…","Kök nedenin … olduğu ortaya çıktı"],["That has a knock-on effect on…","Bunun … üzerinde zincirleme etkisi var"],["Having said that,…","Bununla birlikte…"],["The way I see it,…","Bana göre…"],["In terms of numbers,…","Rakamlara bakarsak…"]],
    close:[["So, to wrap up,…","Toparlarsak…"],["What I need from you is…","Sizden ihtiyacım olan…"],["Happy to take any questions.","Sorularınızı memnuniyetle alırım."]]}
};
function planKit(list){
  const k=document.createElement("div"); k.className="kit";
  list.forEach(([en,tr])=>{const c=document.createElement("button");c.className="chunk";c.textContent=en;
    const sm=document.createElement("small");sm.textContent=tr;c.append(sm);c.onclick=()=>play(clean(en),"y");k.append(c)});
  return k;
}
function renderPlan(){
  const box=$("#plan"); if(!box) return; box.innerHTML="";
  const F=FRAMES[level]||FRAMES[1], ideas=(L().ideas&&L().ideas.length)?L().ideas:L().lines.filter(x=>x.s==="y").map(x=>x.tr).filter(Boolean);
  const step=(title,hint,kit,extra)=>{const d=document.createElement("div");d.className="step";
    const h=document.createElement("h3");h.textContent=title;const p=document.createElement("p");p.className="hint";p.textContent=hint;
    d.append(h,p);if(extra)d.append(extra);d.append(planKit(kit));box.append(d)};
  step("1 · Başla","Konuyu ve ana mesajı tek cümleyle söyle. Konu: "+eT(cur)+".",F.open);
  const ol=document.createElement("ol"); ideas.forEach(t=>{const li=document.createElement("li");li.textContent=t;ol.append(li)});
  step("2 · Sırayla anlat","Bu noktaları sırayla, kendi İngilizcenle anlat. Bağlayıcılar ve konu ifadeleri aşağıda.",[...F.go,...L().chunks],ol);
  step("3 · Bitir","Özetle ve sıradaki adımı söyle.",F.close);
  $("#txBox").placeholder=F.open[0][0];
}

/* ---------- 01 dialogue shadowing with speed check ---------- */
let waitStart=null, waitIdx=-1;
function renderShadow(){
  const box=$("#sentences"); box.innerHTML=""; waitIdx=-1;
  const prog=store.get("lt.prog",{});
  L().lines.forEach((x,i)=>{
    const r=document.createElement("div"); r.className="sent "+(x.s==="y"?"you":"them"); r.id="sent-"+i;
    const b=document.createElement("button"); b.className="playb"; b.setAttribute("aria-label","Cümleyi çal"); b.textContent="▶";
    const mid=document.createElement("div"); mid.className="smid";
    const who=document.createElement("span"); who.className="spk"; who.textContent=x.s==="y"?"Sen":"Karşındaki";
    const p=document.createElement("p"); p.textContent=x.en; p.className="stext";
    mid.append(who,p);
    if(x.tr&&level<3){const q=document.createElement("p");q.className="str";q.textContent=x.tr;mid.append(q)}
    const right=document.createElement("div"); right.className="sright";
    const said=document.createElement("button"); said.className="said"; said.textContent="Söyledim"; said.disabled=true;
    const chip=document.createElement("span"); chip.className="speed";
    const best=prog[progKey(cur.id,level,i)]; if(best) setChip(chip,best);
    right.append(said,chip);
    b.onclick=async()=>{
      mark(i); said.disabled=true; said.classList.remove("ready");
      const d=await play(x.en,x.s);
      r.classList.remove("on");
      if(d==null) return;
      meet(x.w);
      // timing starts when the model sentence ends; the learner repeats aloud, then taps
      waitStart=performance.now(); waitIdx=i; r.dataset.dur=d;
      said.disabled=false; said.classList.add("ready"); said.focus({preventScroll:true});
    };
    said.onclick=()=>{
      if(waitIdx!==i||waitStart==null) return;
      const secs=(performance.now()-waitStart)/1000, d=+r.dataset.dur;
      const pct=Math.min(150,Math.round(d/Math.max(secs-GRACE,0.3)*100));
      said.disabled=true; said.classList.remove("ready"); waitStart=null; waitIdx=-1;
      setChip(chip,pct); meet(x.w);
      const pr=store.get("lt.prog",{}); const k=progKey(cur.id,level,i); pr[k]=Math.max(pr[k]||0,pct); store.set("lt.prog",pr); statAdd("l",1);
      renderLevels(); $("#lineProg").textContent=`${lineDone()}/${L().lines.length} cümle doğal hızda`;
      if(dialogDone(cur,level)) afterProgress();
    };
    r.append(b,mid,right); box.append(r);
  });
  $("#lineProg").textContent=`${lineDone()}/${L().lines.length} cümle doğal hızda`;
  applyHide();
}
function setChip(chip,pct){chip.textContent="%"+pct+" hız";chip.classList.toggle("ok",pct>=PASS)}
function mark(i){document.querySelectorAll(".sent").forEach((x,j)=>x.classList.toggle("on",j===i))}
$("#playAll").onclick=async()=>{
  for(let i=0;i<L().lines.length;i++){
    const x=L().lines[i]; mark(i);
    const d=await play(x.en,x.s); if(d==null) break;
    meet(x.w);
    const tok=playToken;
    // leave room to repeat the sentence aloud before the next one starts
    await new Promise(r=>setTimeout(r,(d/rate())*1000*1.1+700));
    if(tok!==playToken) break;
  }
  mark(-1);
};
function applyHide(){const h=$("#hideText").checked;document.querySelectorAll(".stext,.str").forEach(p=>p.style.filter=h?"blur(6px)":"none")}
$("#hideText").onchange=applyHide;

/* ---------- speech recognition (works only where the browser allows the microphone) ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const low=t=>t.toLowerCase().replace(/[^a-z0-9' ]/g,"");
function mergeSeg(segs,t){const last=segs[segs.length-1];
  if(last&&low(t).startsWith(low(last))) segs[segs.length-1]=t; else if(!(last&&low(last).startsWith(low(t)))) segs.push(t)}
/* collapse immediately repeated word runs ("I'm a I'm a manufacturing" -> "I'm a manufacturing") */
function dedupeRuns(text){
  let w=text.split(/\s+/).filter(Boolean), changed=true;
  while(changed){changed=false;
    for(let n=4;n>=1&&!changed;n--) for(let i=0;i+2*n<=w.length;i++){
      if(w.slice(i,i+n).map(low).join(" ")===w.slice(i+n,i+2*n).map(low).join(" ")){w.splice(i,n);changed=true;break}}}
  // a run that is the start of the next run ("I'm a I'm a manufacturing engineer")
  return w.join(" ");
}
function makeRec(onText,onEnd){
  if(!SR) return null;
  try{
    const r=new SR(); r.lang="en-US"; r.continuous=true; r.interimResults=true;
    // Chrome on Android repeats the growing phrase in every result ("I'm", "I'm a", "I'm a manufacturing"…),
    // so the transcript is rebuilt from all results each time and a result that extends the previous one replaces it.
    r.onresult=e=>{
      const segs=[]; let interim="";
      for(let i=0;i<e.results.length;i++){
        const t=e.results[i][0].transcript.trim(); if(!t) continue;
        if(e.results[i].isFinal) mergeSeg(segs,t); else interim=interim?interim+" "+t:t;
      }
      if(interim){const last=segs[segs.length-1]; if(last&&low(interim).startsWith(low(last))){segs.pop()} else if(last&&low(last).startsWith(low(interim))) interim=""}
      const f=dedupeRuns(segs.join(" ")); onText(f?f+" ":"",interim)};
    r.onerror=e=>{onEnd&&onEnd(e.error)}; r.onend=()=>onEnd&&onEnd();
    return r;
  }catch{return null}
}

/* ---------- 02 4/3/2 ---------- */
let roundIdx=0, timer=null, remain=0, total=0, rec=null;
const C=276.46;
function durations(){return $("#pace").value.split(",").map(Number)}
function fmt(s){return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")}
function renderRounds(){
  const d=durations(), box=$("#rounds"); box.innerHTML="";
  d.forEach((s,i)=>{const e=document.createElement("span");e.className="rd"+(i<roundIdx?" done":i===roundIdx?" now":"");e.textContent=(i+1)+". tur · "+fmt(s);box.append(e)});
  const btn=$("#startRound");
  if(roundIdx>=d.length){btn.textContent="Üç tur tamam";btn.disabled=true;$("#clock").textContent="✓";$("#arc").style.strokeDashoffset=0}
  else{btn.textContent=(roundIdx+1)+". turu başlat";btn.disabled=!!timer;if(!timer){$("#clock").textContent=fmt(d[roundIdx]);$("#arc").style.strokeDashoffset=0}}
}
function setPaceForLevel(){if(!timer){$("#pace").value=LEVELS[level].pace;roundIdx=0}}
$("#pace").onchange=()=>{stopRound();roundIdx=0;renderRounds()};
$("#startRound").onclick=()=>{
  const d=durations(); total=remain=d[roundIdx];
  // each round's speech is written live into the box, replacing the previous round's text
  $("#startRound").disabled=true; $("#liveTx").textContent=""; $("#liveTx").hidden=true; $("#txBox").value=""; $("#txOut").innerHTML="";
  rec=makeRec((f,i)=>{const b=$("#txBox"); b.value=(f+i).trim(); b.scrollTop=b.scrollHeight; $("#rbLive").textContent=b.value.slice(-60)}, ()=>{});
  // while speaking, the plan fills the screen and a small floating bar carries the clock
  $("#rbLabel").textContent=(roundIdx+1)+". tur"; $("#rbClock").textContent=fmt(remain); $("#rbLive").textContent=""; $("#roundBar").hidden=false;
  $("#plan").scrollIntoView({behavior:"smooth",block:"start"});
  try{rec&&rec.start()}catch{rec=null}
  timer=setInterval(()=>{remain--; $("#clock").textContent=fmt(Math.max(remain,0)); $("#rbClock").textContent=fmt(Math.max(remain,0));
    $("#arc").style.strokeDashoffset=C*(1-remain/total);
    if(remain<=0) finishRound()
  },1000);
};
function stopRound(){clearInterval(timer);timer=null;try{rec&&rec.stop()}catch{}rec=null;$("#roundBar").hidden=true}
function finishRound(){stopRound();roundIdx++;renderRounds();beep();statAdd("r",1);if(roundIdx>=durations().length) markTask("r");$(".timer").scrollIntoView({behavior:"smooth",block:"center"})}
$("#rbStop").onclick=finishRound;
$("#resetRounds").onclick=()=>{stopRound();roundIdx=0;renderRounds()};
function beep(){try{const a=new AudioContext(),o=a.createOscillator(),g=a.createGain();o.frequency.value=660;g.gain.value=.08;o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+.25)}catch{}}

/* ---------- Claude ---------- */
let sample=null;
const aiReady = (async()=>{try{sample=await window.claude?.use?.("sample")}catch{sample=null}
  if(!sample) aiOff(); return sample})();
/* without Claude the meeting runs as a scripted meeting and 4/3/2 shows the model talk instead of a rewrite */
function aiOff(){ $("#modeClaude").hidden=true; if(meetMode!=="script"){meetMode="script";renderModes();resetMeeting()} $("#txFeedback").textContent="Örnek anlatımı göster"; $("#txFeedback").disabled=false }
function errCopy(e){
  const c=e?.code;
  if(["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed"].includes(c)){aiOff();return "Bu sayfanın Claude'u kullanmasına izin verilmedi, bu yüzden partner kapalı."}
  if(c==="rate_limited") return "Çok sık istek gitti. Biraz bekleyip tekrar gönder.";
  if(c==="session_expired") return "Oturum süresi dolmuş. claude.ai'ye yeniden giriş yapıp tekrar dene.";
  if(c==="invalid_json"||c==="empty_completion") return "Cevap okunamadı. Tekrar gönder.";
  if(c==="cancelled") return "";
  return "Bağlantı kesildi. Tekrar gönder.";
}
function listenBtn(text,sp="t"){const p=document.createElement("button");p.className="mini";p.textContent="Dinle";p.onclick=()=>play(text,sp);return p}
function chunkRow(chunks,alignEnd){
  const k=document.createElement("div");k.className="kit";if(alignEnd)k.style.justifyContent="flex-end";
  chunks.forEach(c=>{if(!c?.en)return;const x=document.createElement("button");x.className="chunk";x.textContent=String(c.en);const sm=document.createElement("small");sm.textContent=String(c.tr||"");x.append(sm);x.onclick=()=>play(clean(String(c.en)),"y");k.append(x)});
  return k;
}
function suggestBox(text){
  const r=document.createElement("div");r.className="recast";
  const b=document.createElement("b");b.textContent="Anlaşılmadı. Şöyle cevap verebilirsin";
  const s=document.createElement("span");s.textContent=text;
  const u=document.createElement("button");u.className="mini";u.style.marginLeft="6px";u.textContent="Yazı kutusuna al";
  u.onclick=()=>{$("#say").value=text;$("#say").focus()};
  r.append(b,s,document.createElement("br"),listenBtn(text,"y"),u);return r;
}
function recastBox(text){
  const r=document.createElement("div");r.className="recast";
  const b=document.createElement("b");b.textContent="Daha doğal hali";
  const s=document.createElement("span");s.textContent=text;
  r.append(b,s,document.createElement("br"),listenBtn(text,"y"));return r;
}
/* words the partner should weave in this meeting; refreshed when a meeting starts */
let targets=[];
function pickTargets(){targets=[...dueWords(6),...newWords(10-Math.min(6,dueWords(6).length))]}
function targetLine(){
  if(!targets.length) return "";
  return `\nVocabulary recycling (hidden from the learner): during this meeting, naturally use as many of these words as fit the scenario, spread over your replies and recasts, in any grammatical form. Never list them, highlight them, define them or mention that you are using them. Skip any word that would sound forced or inappropriate at work: ${targets.map(i=>OX[i]).join(", ")}.`;
}

/* meeting chat */
let turns=[], ctl=null;
function rules(){
  return `You are role-playing in an English speaking-practice app for a Turkish mechanical engineer who is an expert in composite materials (analysis, calculations, manufacturing). The goal is spoken fluency in work meetings, without grammar lessons.

Scenario (the learner's brief, in Turkish): ${bf()}
You play: ${rl()}.

Learner level ${level} of 3 (${LEVELS[level].name}). Language style: ${LEVELS[level].style}

Rules:
- Stay in role. Reply like a real person in this conversation: 1-3 short spoken sentences, then usually one follow-up question that makes the learner explain more (numbers, reasons, next steps, opinions).
- The learner may write Turkish words where they lack the English. Understand them and carry on.
- Never explain grammar. Instead give a "recast": the learner's last message rewritten as a fluent speaker at this level would say it, keeping their meaning and content. If it was already natural, recast can be an empty string.
- If the learner's last message is meaningless, random letters, unrelated to your question, or too broken to understand: do NOT move the conversation on. Set "understood" to false. In "reply", stay in role and say briefly that you didn't follow, then ask the same question again in simpler words. Put "" in "recast". In "suggest", write a good answer the learner could give to your previous question, as a fluent speaker at this level would say it, using the facts from the scenario brief (invent plausible details if needed).
- If the message is understandable, set "understood" to true and "suggest" to "".
- Pick 1-2 useful chunks (multi-word phrases) from your recast or reply that the learner should reuse, each with a short Turkish gloss.
- Use correct composite and business terminology where relevant.${targetLine()}

Reply with only JSON: {"understood": boolean, "reply": string, "recast": string, "suggest": string, "chunks": [{"en": string, "tr": string}]}`;
}
function addMsg(who,text){
  const m=document.createElement("div"); m.className="msg "+(who==="me"?"me":"them");
  const w=document.createElement("span"); w.className="who"; w.textContent=who==="me"?"Sen":"Karşındaki";
  const b=document.createElement("div"); b.className="bubble"; b.textContent=text;
  m.append(w,b);
  if(who!=="me"&&text&&!/…$/.test(text)){m.append(listenBtn(text,"t"))}
  $("#log").append(m); $("#log").scrollTop=$("#log").scrollHeight; return b;
}
function resetMeeting(){
  if(meetMode==="script") return scriptReset();
  ctl?.abort(); turns=[]; $("#log").innerHTML=""; pickTargets();
  addMsg("them",opener());
  turns.push({role:"assistant",content:opener()});
}
$("#newMeeting").onclick=()=>{micOff(); resetMeeting(); if(meetMode==="script"){meetVoice=true; const pr=pairs()[0]; if(pr&&$("#speakBack").checked) play(pr[0].en,"t")}};
$("#send").onclick=async()=>{
  micOff();
  if(meetMode==="script") return scriptSend();
  const text=$("#say").value.trim(); if(!text||!sample) return;
  $("#say").value=""; addMsg("me",text); meet(oxIn(text));
  warmNeural(); statAdd("t",1);
  turns.push({role:"user",content:text});
  if(turns.filter(t=>t.role==="user").length>=6) markTask("m");   // a free meeting with Claude counts after six answers
  const pending=addMsg("them","Düşünüyor…");
  $("#send").disabled=true; $("#stopAi").hidden=false;
  ctl=new AbortController();
  try{
    const recent=turns.slice(-12); if(recent[0].role!=="user") recent.unshift({role:"user",content:"(meeting starts)"});
    const out=await sample.json([{role:"user",content:rules()},{role:"assistant",content:"Understood. I'll stay in role and reply in JSON."},...recent],{cache:false,modelTier:"quick",signal:ctl.signal});
    const reply=String(out?.reply||"").trim()||"Could you say a bit more about that?";
    pending.parentElement.remove();
    const chunks=Array.isArray(out?.chunks)?out.chunks:[];
    const mine=[...document.querySelectorAll(".msg.me")].pop();
    const sug=String(out?.suggest||"").trim();
    if(mine&&sug&&out?.understood!==true){mine.append(suggestBox(sug));if(chunks.length)mine.append(chunkRow(chunks,true))}
    else if(mine&&out?.recast){mine.append(recastBox(String(out.recast)));if(chunks.length)mine.append(chunkRow(chunks,true))}
    addMsg("them",reply);
    turns.push({role:"assistant",content:reply});
    meet(oxIn(reply+" "+String(out?.recast||"")+" "+sug));
    chunks.forEach(c=>c?.en&&savePhrase(String(c.en),String(c.tr||"")));
    if($("#speakBack").checked) play(reply,"t");
  }catch(e){
    turns.pop(); pending.textContent=errCopy(e)||"Durduruldu."; pending.parentElement.querySelector(".who").textContent="Not";
  }finally{$("#send").disabled=!sample||$("#say").disabled;$("#stopAi").hidden=true}
};
$("#stopAi").onclick=()=>ctl?.abort();
$("#say").addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))$("#send").click()});

/* mic button for the chat, shown only if recognition exists */
let chatRec=null;
// sending (or restarting) ends dictation, so the partner's spoken reply is never typed into the box
function micOff(){ if(!chatRec) return; const r=chatRec; chatRec=null; r.onresult=null; r.onend=null; r.onerror=null; try{r.abort()}catch{} $("#mic").textContent="Konuş" }
if(SR){$("#mic").hidden=false;
  $("#mic").onclick=()=>{
    if(chatRec){try{chatRec.stop()}catch{};return}
    const base=$("#say").value?($("#say").value+" "):"";
    chatRec=makeRec((f,i)=>{$("#say").value=base+(f+i).trim()},err=>{
      chatRec=null;$("#mic").textContent="Konuş";
      if(err==="not-allowed"||err==="service-not-allowed"){$("#mic").hidden=true;$("#say").placeholder="Mikrofona izin verilmedi. Tarayıcı ayarlarından mikrofon iznini aç ya da klavyenin mikrofon tuşuyla dikte et."}
    });
    if(!chatRec){$("#mic").hidden=true;return}
    try{chatRec.start();$("#mic").textContent="Dinliyor… bitir"}catch{chatRec=null}
  };
}

/* 4/3/2 feedback */
$("#txFeedback").onclick=async()=>{
  if(!sample) return modelTalk();
  const t=$("#txBox").value.trim(); if(!t) return;
  const out=$("#txOut"); out.innerHTML='<p class="muted">Düşünüyor…</p>'; $("#txFeedback").disabled=true;
  meet(oxIn(t));
  const due=dueWords(5).map(i=>OX[i]);
  try{
    const r=await sample.json(`A Turkish composite-materials engineer just explained this topic aloud in English during a timed fluency drill:
"${bf()}"

Learner level ${level} of 3 (${LEVELS[level].name}). Style for the rewrite: ${LEVELS[level].style}

What they said (may contain Turkish words or transcription errors):
"""${t.slice(0,4000)}"""
${due.length?`\nWhere they fit naturally, use some of these words in the rewrite without drawing attention to them: ${due.join(", ")}.\n`:""}
Do not explain grammar. Return only JSON:
{"recast": "their talk rewritten as a natural spoken version at this level, same content, similar length",
 "chunks": [{"en": "a reusable multi-word phrase from the recast", "tr": "short Turkish gloss"}] (3-5 items),
 "tip": "one short sentence in Turkish on how to sound more fluent next round (e.g. a linking phrase to use), no grammar terms"}`,{modelTier:"default",cache:false});
    out.innerHTML="";
    out.append(recastBox(String(r?.recast||""))); meet(oxIn(String(r?.recast||"")));
    if(r?.tip){const tp=document.createElement("p");tp.style.marginTop="8px";tp.textContent=String(r.tip);out.append(tp)}
    if(Array.isArray(r?.chunks)){r.chunks.forEach(c=>c?.en&&savePhrase(String(c.en),String(c.tr||"")));const k=chunkRow(r.chunks);k.style.marginTop="8px";out.append(k)}
  }catch(e){out.innerHTML="";const p=document.createElement("p");p.className="muted";p.textContent=errCopy(e);out.append(p)}
  finally{$("#txFeedback").disabled=!sample}
};

/* ---------- word rescue ---------- */
function norm(s){return s.toLocaleLowerCase("tr").replace(/[^\p{L}\p{N} ]/gu,"").trim()}
$("#rescueBtn").onclick=async()=>{
  const q=$("#rescueIn").value.trim(); if(!q) return;
  const out=$("#rescueOut"); out.innerHTML="";
  const hit=GLOSS.find(([tr])=>norm(tr).includes(norm(q))||norm(q).includes(norm(tr)));
  const show=(en,ex,alt)=>{out.innerHTML="";const a=document.createElement("p");a.className="en";a.textContent=en;const b=document.createElement("p");b.textContent=ex;b.style.fontStyle="italic";out.append(a,b);
    if(alt){const c=document.createElement("p");c.className="muted";c.style.fontSize=".88rem";c.textContent=alt;out.append(c)}
    if(ex) out.append(listenBtn(ex,"y")); savePhrase(en,q); meet(oxIn(en+" "+ex))};
  if(hit){show(hit[1],hit[2]);return}
  if(!sample){out.textContent="Sözlükte bulunamadı. Toplantı partneri açıkken daha geniş arama yapılabilir.";return}
  out.innerHTML='<p class="muted">Aranıyor…</p>';
  try{
    const r=await sample.json(`A Turkish composite-materials engineer is speaking English (topic: ${eT(cur)}, ${cur.tag}) and can't recall how to say: "${q}" (Turkish word or a description).
Return only JSON: {"en": "the natural English word or phrase a fluent speaker would actually say", "example": "one short spoken sentence using it in this context", "alt": "optional: a simpler way around it if the word still doesn't come, starting with 'Kurtarma yolu:' in Turkish, then the English workaround"}`,{modelTier:"quick"});
    show(String(r?.en||q),String(r?.example||""),r?.alt?String(r.alt):"");
  }catch(e){out.textContent=errCopy(e)}
};
$("#rescueIn").addEventListener("keydown",e=>{if(e.key==="Enter")$("#rescueBtn").click()});

/* ---------- my phrases ---------- */
function savePhrase(en,tr){const l=store.get("lt.mine",[]);if(l.some(x=>x.en.toLowerCase()===en.toLowerCase()))return;l.unshift({en,tr});store.set("lt.mine",l.slice(0,80));renderMine()}
function renderMine(){
  const l=store.get("lt.mine",[]), box=$("#mine"); box.innerHTML="";
  const rows = l.length? l : L().chunks.slice(0,4).map(([en,tr])=>({en,tr}));
  if(!l.length){const p=document.createElement("p");p.className="muted";p.style.fontSize=".85rem";p.textContent="Henüz yok. Örnek olarak bu konunun kitinden birkaç ifade:";box.append(p)}
  rows.forEach(x=>{const d=document.createElement("div");const a=document.createElement("span");a.textContent=x.en;const b=document.createElement("span");b.textContent=x.tr;d.append(a,b);d.style.cursor="pointer";d.onclick=()=>play(clean(x.en),"y");box.append(d)});
}

function renderAll(){stopAudio();renderStats();renderLevels();renderCats();renderScenList();renderBrief();renderShadow();renderPlan();setPaceForLevel();renderRounds();renderMine();renderMemory()}

/* ---------- practice statistics (per day, kept with the progress) ---------- */
const dayKey=(t=Date.now())=>{const d=new Date(t);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
function statAdd(f,n){
  const st=store.get("lt.stats",{d:{}}); st.d=st.d||{}; const k=dayKey(); const e=st.d[k]=st.d[k]||{s:0,l:0,t:0,r:0};
  e[f]=(e[f]||0)+n; store.set("lt.stats",st); if(f!=="s"||e.s%60===0) renderStats();
}
let lastAct=Date.now();
["pointerdown","keydown","scroll","touchstart"].forEach(ev=>addEventListener(ev,()=>{lastAct=Date.now()},{passive:true}));
setInterval(()=>{ if(document.visibilityState==="visible"&&(Date.now()-lastAct<120000||!player.paused)) statAdd("s",15) },15000);
function fmtDur(sec){const m=Math.round(sec/60); return m<60?m+" dk":Math.floor(m/60)+" sa "+(m%60)+" dk"}
function renderStats(){
  if(!$("#statTiles")) return;
  const days=(store.get("lt.stats",{d:{}}).d)||{}, sum=f=>Object.values(days).reduce((a,e)=>a+(e[f]||0),0);
  let streak=0; for(let i=0;;i++){const e=days[dayKey(Date.now()-i*864e5)]; if(e&&(e.s>=60||e.l||e.t||e.r)) streak++; else if(i>0) break; if(i>400)break}
  const week=Array.from({length:7},(_,i)=>days[dayKey(Date.now()-i*864e5)]?.s||0).reduce((a,b)=>a+b,0);
  let dlg=0; SCEN.forEach(sc=>[1,2,3].forEach(lv=>{if(sc.levels[lv]&&dialogDone(sc,lv)) dlg++}));
  const tiles=[[fmtDur(sum("s")),"toplam çalışma"],[fmtDur(week),"son 7 gün"],[streak+" gün","üst üste çalışma"],[dlg,"diyalog doğal hızda bitti"],[sum("l"),"cümle tekrar edildi"],[sum("t"),"toplantı mesajı"],[sum("r"),"4/3/2 turu"],[Object.keys(SEEN).length,"Oxford kelimesiyle karşılaşma"]];
  const tg=$("#statTiles"); tg.innerHTML="";
  tiles.forEach(([n,l])=>{const d=document.createElement("div");d.className="tile";const b=document.createElement("b");b.textContent=n;const sp=document.createElement("span");sp.textContent=l;d.append(b,sp);tg.append(d)});
  const ch=$("#statChart"); ch.innerHTML=""; const vals=Array.from({length:14},(_,i)=>{const t=Date.now()-(13-i)*864e5;return [t,Math.round((days[dayKey(t)]?.s||0)/60)]});
  const mx=Math.max(10,...vals.map(v=>v[1]));
  vals.forEach(([t,m])=>{const c=document.createElement("div");c.className="col";const d=new Date(t);
    const tip=d.toLocaleDateString("tr-TR",{day:"numeric",month:"short"})+": "+m+" dk";c.title=tip;c.setAttribute("aria-label",tip);
    const bar=document.createElement("span");bar.className="bar";bar.style.height=(m?Math.max(4,m/mx*100):0)+"%";
    const lab=document.createElement("small");lab.textContent=d.getDate();c.append(bar,lab);ch.append(c)});
  $("#statMax").textContent=mx+" dk";
}

/* ---------- where you left off ---------- */
const SECS=[["shadow","Diyaloğu dinle ve tekrar et"],["retell","4/3/2 anlatım"],["meet","Toplantı simülasyonu"]];
document.querySelectorAll("section.station").forEach((el,i)=>{if(SECS[i]) el.id="st-"+SECS[i][0]});
let whereT=null;
const io=("IntersectionObserver" in window)?new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting&&e.intersectionRatio>.4){
  const sec=e.target.id.slice(3); clearTimeout(whereT); whereT=setTimeout(()=>{const w=store.get("lt.where",{}); if(w.sec!==sec) store.set("lt.where",{sec})},4000)}})},{threshold:[.4]}):null;
if(io) document.querySelectorAll("section.station").forEach(el=>io.observe(el));
function showResume(){
  const w=store.get("lt.where",null), box=$("#resume"); if(!box) return;
  // only real practice counts (a repeated line, a meeting turn, a 4/3/2 round), not time spent looking around
  const days=Object.values(store.get("lt.stats",{d:{}}).d||{});
  const any=Object.keys(store.get("lt.prog",{})).length||days.some(e=>(e.l||0)+(e.t||0)+(e.r||0)>0);
  if(!any||!w){box.hidden=true;return}
  const sec=SECS.find(x=>x[0]===w?.sec)||SECS[0];
  $("#resumeTxt").textContent=`Kaldığın yer: ${eT(cur)} · ${LEVELS[level].name} · ${sec[1]}`;
  $("#resumeBtn").onclick=()=>{const el=$("#st-"+sec[0]); el&&el.scrollIntoView({behavior:"smooth",block:"start"})};
  box.hidden=false;
}

/* ---------- account sync: progress saved to the signed-in viewer's private record ---------- */
const ACC={ref:null,pushing:false,again:false,timer:null,ok:false};
const DEVICE=(()=>{let d=null;try{d=localStorage.getItem("lt.device");if(!d){d=Math.random().toString(36).slice(2);localStorage.setItem("lt.device",d)}}catch{} return d||Math.random().toString(36).slice(2)})();
function accState(t,cls){const e=$("#accState"); if(e){e.textContent=t; e.className="acc-state "+(cls||"")}}
function scheduleSync(){ if(!ACC.ref||ACC.timer) return; ACC.timer=setTimeout(()=>{ACC.timer=null;pushSync()},8000) }
async function pushSync(){
  if(!ACC.ref) return; if(ACC.pushing){ACC.again=true;return}
  ACC.pushing=true; accState("Kaydediliyor…");
  const kv={}; SYNC_KEYS.forEach(k=>{const v=store.get(k,undefined); if(v!==undefined) kv[k]=v});
  try{ await ACC.ref.set({v:1,updatedAt:+store.get("lt.updatedAt",Date.now()),device:DEVICE,kv}); accState("İlerlemen hesabına kaydedildi","ok") }
  catch(e){ if(e?.code==="invalid_argument"||e?.code==="revoked"||e?.code==="not_granted"){ACC.ref=null;accState("İlerleme sadece bu cihazda tutuluyor")} else if(e?.code==="quota_exceeded"){accState("Kayıt alanı doldu; ilerleme bu cihazda tutuluyor","warn")} else accState("Kaydedilemedi, tekrar denenecek","warn"); if(ACC.ref) setTimeout(scheduleSync,15000)}
  ACC.pushing=false; if(ACC.again){ACC.again=false;scheduleSync()}
}
function applyRemote(d){
  const kv=d.kv||{}; const prevScen=cur.id;
  Object.entries(kv).forEach(([k,v])=>{if(SYNC_KEYS.includes(k)) store.put(k,v)});
  store.put("lt.updatedAt",d.updatedAt||Date.now());
  cat=store.get("lt.cat","work"); cur=SCEN.find(s=>s.id===store.get("lt.scen"))||cur;
  unlocked=Math.min(3,Math.max(1,+store.get("lt.unlocked",1)||1)); level=Math.min(unlocked,+store.get("lt.level",1)||1);
  SEEN=store.get("lt.seen",{});
  if(store.get("lt.howto",0)) $("#howto").hidden=true;
  ensureOpen(); loadAudio(cur.id); renderAll(); renderMemory(); renderMine(); if(cur.id!==prevScen) resetMeeting();
}
addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&ACC.ref){clearTimeout(ACC.timer);ACC.timer=null;pushSync()}});
(async()=>{
  const use=n=>window.claude?.use?.(n)?.catch?.(()=>null)??Promise.resolve(null);
  const [db,user]=await Promise.all([use("db"),use("user")]);
  const me=user?await user.me().catch(()=>null):null;
  if(me){ const av=$("#accAvatar"); av.src=me.avatarUrl; av.hidden=false; $("#accName").textContent=me.name||"Hoş geldin"; personalize(me.name); }
  if(!db||!me?.id){ accState("Giriş yapılmadığı için ilerleme sadece bu cihazda tutuluyor"); showResume(); return }
  ACC.ref=db.doc("data/users/"+me.id+"/progress"); accState("Hesabın yükleniyor…");
  try{
    const snap=await ACC.ref.get(); const localAt=+store.get("lt.updatedAt",0);
    if(snap.exists&&(snap.data().updatedAt||0)>localAt) applyRemote(snap.data());
    else if(localAt>(snap.exists?(snap.data().updatedAt||0):0)) await pushSync();
    accState("İlerlemen hesabına kaydediliyor","ok"); ACC.ok=true;
  }catch(e){ ACC.ref=null; accState("Hesaba ulaşılamadı; ilerleme bu cihazda tutuluyor","warn") }
  showResume();
  if(ACC.ref) ACC.ref.onSnapshot(sn=>{ if(!sn.exists||sn.metadata.hasPendingWrites) return; const d=sn.data();
    if(d.device!==DEVICE&&(d.updatedAt||0)>+store.get("lt.updatedAt",0)) applyRemote(d) },()=>{});
})();

/* ---------- scripted meeting: the partner asks the dialogue's questions, the learner answers freely ---------- */
let meetMode="script", sc={i:0,good:0,asked:0};
const STOP=new Set("a an the i you we he she it they me us him her them my our your their its is are was were be been am do does did to of in on at for with and or but so if that this these those there here as by from about into than then can could will would should shall may might must have has had not no yes just very also too oh well ok okay".split(" "));
const NUMW={zero:"0",one:"1",two:"2",three:"3",four:"4",five:"5",six:"6",seven:"7",eight:"8",nine:"9",ten:"10",twelve:"12",fifteen:"15",twenty:"20",thirty:"30",fifty:"50",hundred:"100",thousand:"1000"};
function stem(w){w=NUMW[w]||w; for(const x of ["ing","ed","es","s","ly"]) if(w.length>x.length+2&&w.endsWith(x)) return w.slice(0,-x.length); return w}
function keyWords(t){return [...new Set((t.toLowerCase().replace(/[’']/g,"'").match(/[a-z0-9]+/g)||[]).filter(w=>!STOP.has(w)&&w.length>1).map(stem))]}
function pairs(){const ls=L().lines,out=[]; for(let i=0;i<ls.length;i++) if(ls[i].s==="t"&&ls[i+1]?.s==="y") out.push([ls[i],ls[i+1]]); return out}
// the opening question is not read aloud on page load or topic change, only once the meeting is actually in use
let meetVoice=false;
function scriptAsk(again){
  const pr=pairs()[sc.i]; if(!pr) return scriptEnd();
  addMsg("them",pr[0].en); if(again) note("Anlaşılmadı; aynı soruyu tekrar soruyor. Aşağıdaki örnek cevaba bakıp kendi cümlenle tekrar dene.");
  if($("#speakBack").checked&&meetVoice) play(pr[0].en,"t");
}
function note(t){const p=document.createElement("p");p.className="muted";p.style.fontSize=".85rem";p.textContent=t;$("#log").append(p);$("#log").scrollTop=$("#log").scrollHeight}
function scriptReset(){
  ctl?.abort(); $("#log").innerHTML=""; sc={i:0,good:0,asked:0,tries:0}; meetVoice=false;
  note("Senaryolu toplantı: karşındakinin sorularını kendi cümlelerinle cevapla. Takılırsan İpucu tuşu cevabın Türkçe fikrini gösterir.");
  scriptAsk(false);
}
function scriptSend(){
  const text=$("#say").value.trim(), pr=pairs()[sc.i]; if(!text||!pr) return;
  $("#say").value=""; addMsg("me",text); meet(oxIn(text)); statAdd("t",1); meetVoice=true;
  const key=keyWords(pr[1].en), got=new Set(keyWords(text)), hit=key.filter(w=>got.has(w));
  const score=key.length?hit.length/key.length:0, eng=(text.match(/[a-z]+/gi)||[]).length;
  const mine=[...document.querySelectorAll(".msg.me")].pop();
  if(score<0.2&&!(eng>=5&&hit.length>=1)){
    sc.tries++;
    mine.append(suggestBox(pr[1].en));
    if(sc.tries>=2){sc.tries=0;sc.i++;sc.asked++;note("Sorun değil, sıradaki soruya geçiyoruz.");return scriptAsk(false)}
    return scriptAsk(true);
  }
  sc.tries=0; sc.asked++; if(score>=0.45) sc.good++;
  const box=document.createElement("div");box.className="recast";
  const b=document.createElement("b");b.textContent=score>=0.45?"Güzel. Örnek cevap":"Anlaşıldı. Daha doğal hali";
  const sp=document.createElement("span");sp.textContent=pr[1].en;
  box.append(b,sp,document.createElement("br"),listenBtn(pr[1].en,"y"));
  const miss=key.filter(w=>!got.has(w)).slice(0,6);
  if(miss.length&&score<0.8){const m=document.createElement("small");m.className="muted";m.style.display="block";m.textContent="Örnekte olup seninkinde olmayan kelimeler: "+miss.join(", ");box.append(m)}
  mine.append(box); meet(pr[1].w||[]);
  sc.i++; setTimeout(()=>scriptAsk(false),400);
}
function scriptEnd(){
  markTask("m");
  note(`Toplantı bitti. ${sc.asked} sorudan ${sc.good} tanesini örnek cevaba yakın verdin. "Toplantıyı yeniden başlat" ile tekrar edebilir ya da başka bir konu seçebilirsin.`);
}
$("#hintBtn").onclick=()=>{const pr=pairs()[sc.i]; if(meetMode==="script"&&pr) note("İpucu: "+pr[1].tr)};
function renderModes(){
  $("#modeScript").classList.toggle("on",meetMode==="script"); $("#modeClaude").classList.toggle("on",meetMode==="claude");
  $("#hintBtn").hidden=meetMode!=="script";
  $("#meetWhy").textContent=meetMode==="script"
    ?"Karşındaki bu konunun sorularını sırayla sorar. Cevabını yaz ya da Konuş tuşuyla söyle. Her cevaptan sonra örnek cevabı ve eksik kalan kelimeleri görürsün. Anlaşılmayan cevapta aynı soru tekrar sorulur."
    :"Claude bir meslektaş rolünde sana serbest sorular sorar. Her cevaptan sonra söylediğinin doğal hali gösterilir, ama konuşma hiç durmaz.";
}
$("#modeScript").onclick=()=>{meetMode="script";renderModes();resetMeeting()};
$("#modeClaude").onclick=()=>{if(!sample) return; meetMode="claude";renderModes();resetMeeting()};
aiReady.then(sm=>{ if(sm) $("#modeClaude").hidden=false });
/* 4/3/2 without Claude: the level's dialogue answers read as one model talk */
async function modelTalk(){
  const out=$("#txOut"); out.innerHTML="";
  const ys=L().lines.filter(x=>x.s==="y"), box=document.createElement("div"); box.className="recast";
  const b=document.createElement("b"); b.textContent="Örnek anlatım"; const sp=document.createElement("span"); sp.textContent=ys.map(x=>x.en).join(" ");
  const btn=document.createElement("button"); btn.className="mini"; btn.textContent="Dinle";
  btn.onclick=async()=>{for(const y of ys){const r=await play(y.en,"y"); if(r==null) break}};
  box.append(b,sp,document.createElement("br"),btn); out.append(box);
  if($("#txBox").value.trim()) meet(oxIn($("#txBox").value));
}

/* ---------- practise the same meeting by voice in the Claude app (uses the person's own Claude plan) ---------- */
function voicePrompt(){
  const words=targets.slice(0,10).map(i=>OX[i]).join(", ");
  return `Let's do an English speaking practice in voice mode. I am a Turkish mechanical engineer who specialises in composite materials; I want to become fluent in work meetings without grammar lessons.

Role-play this situation with me. Situation (in Turkish): ${bf()}
You play: ${rl()}.
My level: ${LEVELS[level].name}. ${LEVELS[level].style}

Rules:
- Speak only English. Keep each turn short (1-3 sentences), like a real meeting, then ask me one question.
- When my answer has mistakes or sounds unnatural, first say "You could say:" and the natural version in one sentence, then continue the meeting. Never explain grammar.
- If I don't understand, say it again more simply.
- Naturally use some of these words during the conversation: ${words}.
- After about 10 exchanges, end the meeting and give me 3 useful phrases I should reuse.

Start now with your first line: "${opener()}"`;
}
$("#voiceBtn").onclick=async()=>{
  const t=voicePrompt(); let copied=false;
  try{await navigator.clipboard.writeText(t);copied=true}catch{}
  const a=document.createElement("a"); a.href="https://claude.ai/new?q="+encodeURIComponent(t); a.target="_blank"; a.rel="noopener"; document.body.append(a); a.click(); a.remove();
  $("#voiceNote").hidden=false;
  $("#voiceNote").textContent=(copied?"Talimat panoya kopyalandı ve Claude açılıyor. ":"Claude açılıyor. ")+"Mesajı gönder, sonra Claude'da ses moduna geç ve konuşarak devam et. Claude açılmazsa Claude uygulamasını aç ve talimatı yapıştır.";
  if(!copied){const ta=$("#voiceText"); ta.hidden=false; ta.value=t; ta.select()}
};
renderModes();
/* the dialogues are written for "Kemal"; a signed-in member hears and reads their own first name instead
   (lines with a changed name have no recorded clip, so play() falls back to the in-page voice) */
let curName="Kemal";
function personalize(name){
  name=String(name||"").trim().split(/\s+/)[0]||""; if(!/^[\p{L}'-]{2,20}$/u.test(name)) return;
  name=name[0].toLocaleUpperCase("tr")+name.slice(1); if(name===curName) return;
  const re=new RegExp("(?<!\\p{L})"+curName.replace(/[-']/g,"\\$&")+"(?!\\p{L})","gu");
  const walk=o=>{ if(typeof o==="string") return o.replace(re,name); if(Array.isArray(o)){for(let i=0;i<o.length;i++) o[i]=walk(o[i]); return o}
    if(o&&typeof o==="object"){for(const k in o) o[k]=walk(o[k]); return o} return o };
  SCEN.forEach(walk); curName=name;
  try{ renderAll(); resetMeeting() }catch{}
}
/* first-visit guide: shown once per account (flag synced with progress), reopened from the account box */
function howto(show){ $("#howto").hidden=!show; if(show) $("#howtoGo").focus() }
function maybeHowto(){ const g=document.querySelector("#authGate"); if(!store.get("lt.howto",0)&&!(g&&!g.hidden)) howto(true) }
$("#howtoBtn").onclick=()=>howto(true);
$("#howtoGo").onclick=()=>{ howto(false); if(!store.get("lt.howto",0)) store.set("lt.howto",1) };
$("#howto").onclick=e=>{ if(e.target.id==="howto") $("#howtoGo").click() };
addEventListener("keydown",e=>{ if(e.key==="Escape"&&!$("#howto").hidden) $("#howtoGo").click() });
if(!document.querySelector("#authGate")) setTimeout(maybeHowto,1500);   // with sign-in, the auth flow opens it after the gate
ensureOpen(); loadAudio(cur.id); renderAll(); resetMeeting();
