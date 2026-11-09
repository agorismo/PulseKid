// pulsekid · salvar e carregar o projeto (IndexedDB)
/* ---------- projeto (IndexedDB) ---------- */
const idb=new Promise((res,rej)=>{const r=indexedDB.open('pulsekid',1);r.onupgradeneeded=()=>r.result.createObjectStore('s');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const idbp=async(mode,fn)=>{const d=await idb;return new Promise((res,rej)=>{const tx=d.transaction('s',mode);const q=fn(tx.objectStore('s'));tx.oncomplete=()=>res(q&&q.result);tx.onerror=()=>rej(tx.error)})};
const dbGet=k=>idbp('readonly',s=>s.get(k)),dbPut=(k,v)=>idbp('readwrite',s=>s.put(v,k)),dbDel=k=>idbp('readwrite',s=>s.delete(k)),dbKeys=()=>idbp('readonly',s=>s.getAllKeys()),dbClear=()=>idbp('readwrite',s=>s.clear());
const stored=new Set();let lastMeta='',saving=false;
const fxMeta=f=>({type:f.type,p:f.p,bypass:f.bypass,state:f.state});
async function refreshWam(){
  for(const o of [...tracks,M])for(const f of o.fx)if(f.type==='wam'&&f._wam&&f._wam.getState){try{const s=await f._wam.getState();JSON.stringify(s);f.state=s}catch{}}
}
const getMeta=()=>({v:1,bpm:+$('#bpm').value||120,metro,cnt:cntOn(),snap:snapOn(),loop:{a:loopA,b:loopB,on:loopOn},pps,th,
  master:{vol:M.vol,fx:M.fx.map(fxMeta)},
  tracks:tracks.map(t=>({name:t.name,vol:t.vol,pan:t.pan,mute:t.mute,solo:t.solo,arm:t.arm,fx:t.fx.map(fxMeta),
    ti:t.ti,takes:t.takes.map(a=>a.map(c=>({b:bidOf(c.buf),s:+c.start.toFixed(4),o:+c.off.toFixed(4),d:+c.dur.toFixed(4),fi:+(c.fi||0).toFixed(4),fo:+(c.fo||0).toFixed(4)})))}))});
async function saveProject(force){
  if(recording||saving)return;await refreshWam();const meta=JSON.stringify(getMeta());if(!force&&meta===lastMeta)return;
  saving=true;
  try{
    const used=new Set();
    for(const t of tracks)for(const c of t.takes.flat()){const id=bidOf(c.buf);used.add(id);
      if(!stored.has(id)){await dbPut('b:'+id,{sr:c.buf.sampleRate,ch:Array.from({length:c.buf.numberOfChannels},(_,i)=>c.buf.getChannelData(i).slice())});stored.add(id)}}
    await dbPut('meta',meta);lastMeta=meta;
    for(const k of await dbKeys())if(typeof k==='string'&&k.startsWith('b:')&&!used.has(k.slice(2))){await dbDel(k);stored.delete(k.slice(2))}
    $('#sv').textContent='salvo '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  }catch(e){toast('não consegui salvar o projeto')}
  saving=false;
}
async function loadProject(){
  try{
    const m=JSON.parse(await dbGet('meta')||'null');if(!m)return false;
    $('#bpm').value=m.bpm||120;metro=!!m.metro;$('#cnt').classList.toggle('on',!!m.cnt);$('#snap').classList.toggle('on',m.snap!==false);
    loopA=m.loop?.a||0;loopB=m.loop?.b||0;loopOn=!!m.loop?.on;pps=m.pps||60;th=m.th||88;applyTh();
    M.vol=m.master.vol;M.outN.gain.value=M.vol;M.fx=m.master.fx.map(f=>({...f}));rebuild(M);
    const cache=new Map();
    for(const tm of m.tracks){
      const t=mkTrack(tm.name,{vol:tm.vol,pan:tm.pan,mute:tm.mute,solo:tm.solo,arm:tm.arm,fx:tm.fx.map(f=>({...f}))});
      t.takes=[];for(const arr of (tm.takes||[tm.clips||[]])){const tk=[];t.takes.push(tk);
      for(const cm of arr){let b=cache.get(cm.b);
        if(!b){const r=await dbGet('b:'+cm.b);if(!r)continue;b=ac.createBuffer(r.ch.length,r.ch[0].length,r.sr);r.ch.forEach((d,i)=>b.copyToChannel(d,i));b._bid=cm.b;cache.set(cm.b,b);stored.add(cm.b)}
        tk.push({id:++cid,buf:b,start:cm.s,off:cm.o,dur:cm.d,fi:cm.fi||0,fo:cm.fo||0})}}
      t.ti=Math.min(tm.ti||0,t.takes.length-1)}
    mix();selected=tracks[0]||M;lastMeta=JSON.stringify(getMeta());return tracks.length>0;
  }catch(e){return false}
}
async function newProject(){
  if(!confirm('Começar um projeto novo? O projeto salvo será apagado.'))return;
  pause();tracks.forEach(t=>{try{t.panN.disconnect();t.in.disconnect()}catch{}});tracks.length=0;
  M.fx=[];M.vol=.9;M.outN.gain.value=.9;rebuild(M);selClip=null;undoS=[];redoS=[];pos0=0;loopOn=false;loopA=loopB=0;
  try{await dbClear()}catch{}stored.clear();lastMeta='';$('#sv').textContent='';
  const t=mkTrack();t.arm=true;selected=t;render();ui();
}
$('#save').onclick=()=>saveProject(true).then(()=>toast('projeto salvo'));
$('#new').onclick=newProject;
setInterval(()=>saveProject(),3000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveProject()});
