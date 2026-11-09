// pulsekid · medidores de nível, importar áudio e exportar WAV
/* ---------- loop / meters ---------- */
const buf=new Float32Array(1024);
function lvl(a){a.getFloatTimeDomainData(buf);let s=0;for(const v of buf)s+=v*v;return Math.min(1,Math.sqrt(s/buf.length)*3)}
function fmt(p){return String(Math.floor(p/60)).padStart(2,'0')+':'+(p%60).toFixed(1).padStart(4,'0')}
function frame(){
  const p=pos();$('#time').textContent=fmt(p);$('#ph').style.left=(220+p*pps)+'px';
  if(playing||recording){const sc=$('#scroll'),x=220+p*pps;if(x>sc.scrollLeft+sc.clientWidth-60||x<sc.scrollLeft+220)sc.scrollLeft=Math.max(0,x-300)}
  if(recording&&rec){const pv=$('#prev');if(pv)pv.style.width=Math.max(0,(p-rec.from)*pps)+'px';
    if(p+5>D){D+=30;render();const lane=$('#lane'+rec.t.id),n=document.createElement('div');n.className='prev';n.id='prev';n.style.left=rec.from*pps+'px';lane.appendChild(n)}}
  $('#om').style.width=lvl(an)*100+'%';$('#mm').style.width=(micAn?lvl(micAn):0)*100+'%';
  requestAnimationFrame(frame);
}
frame();

/* ---------- import / export ---------- */
async function loadFile(f){try{const b=await ac.decodeAudioData(await f.arrayBuffer());addTrack(f.name.replace(/\.[^.]+$/,''),b,pos())}catch{toast('formato não suportado')}}
$('#imp').onclick=()=>$('#file').click();$('#file').onchange=e=>{[...e.target.files].forEach(loadFile);e.target.value=''};
addEventListener('dragover',e=>e.preventDefault());addEventListener('drop',e=>{e.preventDefault();[...e.dataTransfer.files].forEach(loadFile)});
$('#add').onclick=()=>addTrack();
async function exportWav(){
  const end=Math.max(0,...tracks.flatMap(t=>t.clips.map(c=>c.start+c.dur)));if(!end)return toast('nada para exportar');
  toast('renderizando...');const sr=ac.sampleRate,off=new OfflineAudioContext(2,Math.ceil((end+2)*sr),sr);
  await ensureWorklets(off);
  const mi=off.createGain(),mo=off.createGain();mo.gain.value=M.vol;chain(off,M.fx,mi,mo,false);mo.connect(off.destination);
  const any=tracks.some(t=>t.solo);
  tracks.forEach(t=>{if(!t.clips.length||t.mute||(any&&!t.solo))return;const i=off.createGain(),g=off.createGain(),pn=off.createStereoPanner();
    g.gain.value=t.vol;pn.pan.value=t.pan;chain(off,t.fx,i,g,false);g.connect(pn);pn.connect(mi);
    t.clips.forEach(c=>{const s=off.createBufferSource();s.buffer=c.buf;s.connect(fadeGain(off,c,c.start,0,c.dur,i));s.start(c.start,c.off,c.dur)})});
  const r=await off.startRendering(),n=r.length,L=r.getChannelData(0),R=r.getChannelData(1),d=new DataView(new ArrayBuffer(44+n*4));
  const w=(o,s)=>[...s].forEach((c,i)=>d.setUint8(o+i,c.charCodeAt(0)));
  w(0,'RIFF');d.setUint32(4,36+n*4,true);w(8,'WAVEfmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,2,true);d.setUint32(24,sr,true);d.setUint32(28,sr*4,true);d.setUint16(32,4,true);d.setUint16(34,16,true);w(36,'data');d.setUint32(40,n*4,true);
  let o=44;for(let i=0;i<n;i++)for(const x of[L[i],R[i]]){const v=Math.max(-1,Math.min(1,x));d.setInt16(o,v<0?v*32768:v*32767,true);o+=2}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([d],{type:'audio/wav'}));a.download='pulsekid.wav';a.click();toast([...tracks,M].some(o=>o.fx.some(f=>f.type==='wam'&&!f.bypass))?'exportado — plugins WAM não entram no WAV':'exportado');
}
$('#exp').onclick=exportWav;
