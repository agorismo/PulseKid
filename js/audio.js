// pulsekid · grafo de áudio, tempo/loop, transporte, metrônomo e gravação
/* ---------- graph ---------- */
M.in=ac.createGain();M.outN=ac.createGain();M.outN.gain.value=M.vol;
const an=ac.createAnalyser();an.fftSize=1024;M.outN.connect(an);an.connect(ac.destination);rebuild(M);
function mix(){const any=tracks.some(t=>t.solo);tracks.forEach(t=>{t.gainN.gain.value=(t.mute||(any&&!t.solo))?0:t.vol;t.panN.pan.value=t.pan})}
function mkTrack(name,extra={}){
  const t={id:++uid,name:name||'trilha '+(tracks.length+1),vol:.8,pan:0,mute:false,solo:false,arm:false,mon:false,fx:[],takes:[[]],ti:0,...extra};
  Object.defineProperty(t,'clips',{get(){return t.takes[t.ti]},set(v){t.takes[t.ti]=v}});
  t.in=ac.createGain();t.gainN=ac.createGain();t.panN=ac.createStereoPanner();t.outN=t.gainN;
  t.gainN.connect(t.panN);t.panN.connect(M.in);rebuild(t);tracks.push(t);return t;
}
function addClip(t,buf,start,off=0,dur){const c={id:++cid,buf,start,off,dur:dur??(buf.duration-off),fi:0,fo:0};t.clips.push(c);return c}
function addTrack(name,buf,start=0){const t=mkTrack(name);if(buf)addClip(t,buf,start);mix();render();select(t);return t}
const bidOf=b=>b._bid||(b._bid=Date.now().toString(36)+Math.random().toString(36).slice(2,7));

/* ---------- tempo / loop helpers ---------- */
const spb=()=>60/Math.max(30,+$('#bpm').value||120);
const snapOn=()=>$('#snap').classList.contains('on');
const snap=x=>snapOn()?Math.round(x/spb())*spb():x;
const loopActive=()=>loopOn&&!recording&&loopB>loopA+.01&&pos0<loopB;

/* ---------- transport ---------- */
const pos=()=>{if(!playing)return pos0;const p=Math.max(pos0,pos0+ac.currentTime-t0);return loopActive()?Math.min(p,loopB):p};
function scheduleRange(a,T,b){
  tracks.forEach(t=>t.clips.forEach(c=>{const cs=c.start,ce=cs+c.dur;if(ce<=a||cs>=b)return;const s=Math.max(cs,a),e=Math.min(ce,b);if(e-s<.001)return;
    const src=ac.createBufferSource();src.buffer=c.buf;src.connect(fadeGain(ac,c,T+(s-a),s-cs,e-cs,t.in));src.start(T+(s-a),c.off+(s-cs),e-s);srcs.push(src)}));
}
/* envelope de fade do clipe: x0..x1 = trecho tocado (segundos dentro do clipe), T = tempo do contexto em x0 */
function fadeGain(ctx,c,T,x0,x1,dest){
  const g=ctx.createGain(),fi=c.fi||0,fo=c.fo||0,d=c.dur;
  const v=x=>Math.max(0,Math.min(1,fi>0?x/fi:1,fo>0?(d-x)/fo:1));
  g.gain.setValueAtTime(v(x0),T);
  if(fi>0&&x0<fi)g.gain.linearRampToValueAtTime(v(Math.min(fi,x1)),T+(Math.min(fi,x1)-x0));
  if(fo>0&&x1>d-fo){const xs=Math.max(x0,d-fo);if(xs>x0)g.gain.setValueAtTime(v(xs),T+(xs-x0));g.gain.linearRampToValueAtTime(v(x1),T+(x1-x0))}
  g.connect(dest);return g;
}
const metroReset=p=>{nextBeat=Math.ceil(p/spb()-1e-6)};
function schedule(){t0=ac.currentTime+.05;srcs=[];lapPending=false;scheduleRange(pos0,t0,loopActive()?loopB:Infinity);metroReset(pos0)}
function stopSrcs(){srcs.forEach(s=>{try{s.stop()}catch{}});srcs=[]}
async function play(){await ac.resume();if(playing)return;playing=true;schedule();ui()}
function pause(){if(!playing)return;pos0=pos();playing=false;stopSrcs();ui()}
function seek(p){if(recording)return;const w=playing;if(w)pause();pos0=Math.max(0,p);if(w)play();ui()}
function ui(){$('#pp').textContent=playing?'❚❚':'▶';$('#rc').classList.toggle('on',recording||counting);$('#metro').classList.toggle('on',metro);$('#loop').classList.toggle('on',loopOn)}
$('#pp').onclick=()=>playing?(recording?stopRec():pause()):play();
$('#rw').onclick=()=>seek(0);

/* metrônomo + loop sem emenda (agenda adiante) */
function click(when,acc){const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=acc?1600:1000;
  g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(.3,when+.002);g.gain.exponentialRampToValueAtTime(.0001,when+.05);
  o.connect(g);g.connect(ac.destination);o.start(when);o.stop(when+.06);return o}
function tick(){
  if(!playing)return;
  if(loopActive()){const endT=t0+(loopB-pos0);
    if(!lapPending&&endT-ac.currentTime<.2){scheduleRange(loopA,endT,loopB);lapPending=true}
    if(ac.currentTime>=endT){pos0=loopA;t0=endT;lapPending=false;metroReset(loopA)}}
  if(metro){const sp=spb();for(let g=0;g<64;g++){const bp=nextBeat*sp,when=t0+(bp-pos0);if(when>ac.currentTime+.12)break;
    if(loopActive()&&bp>=loopB-1e-6)break;if(when>=ac.currentTime-.05)click(when,nextBeat%4===0);nextBeat++}}
}
setInterval(tick,25);
$('#metro').onclick=()=>{metro=!metro;ui();if(playing)metroReset(pos())};
$('#loop').onclick=()=>{loopOn=!loopOn;if(loopOn&&loopB<=loopA+.01){loopA=0;loopB=spb()*16}drawLoop();ui();if(playing)seek(pos())};
$('#snap').onclick=e=>e.currentTarget.classList.toggle('on');
$('#bpm').onchange=()=>{render();if(playing)metroReset(pos())};

/* ---------- gravação ---------- */
const WK=`class R extends AudioWorkletProcessor{constructor(){super();this.on=false;this.port.onmessage=e=>{this.on=e.data}}process(i){if(this.on&&i[0]&&i[0][0])this.port.postMessage(i[0][0].slice());return true}}registerProcessor('rec',R)`;
let micCh=1,micSplit=null,recZ=null;
/* uma entrada (interface) com N canais; cada trilha armada grava o canal escolhido em t.ch */
async function setupMic(){
  if(micStream&&micStream.active&&micStream._dev===$('#dev').value)return;
  if(micStream)micStream.getTracks().forEach(t=>t.stop());
  try{micSrc&&micSrc.disconnect();micSplit&&micSplit.disconnect()}catch{}
  const id=$('#dev').value;
  micStream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:id?{exact:id}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:{ideal:32}}});
  const n=Math.max(1,Math.min(32,micStream.getAudioTracks()[0].getSettings().channelCount||1)),changed=n!==micCh;micCh=n;
  micStream._dev=id;micSrc=ac.createMediaStreamSource(micStream);micAn=ac.createAnalyser();micAn.fftSize=1024;micSrc.connect(micAn);
  micSplit=ac.createChannelSplitter(micCh);micSrc.connect(micSplit);
  const devs=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput'),sel=$('#dev');
  sel.innerHTML='<option value="">padrão</option>'+devs.map(d=>`<option value="${d.deviceId}">${d.label||'entrada'}</option>`).join('');sel.value=id;
  updateMon();if(changed)render();
}
const chOf=t=>Math.min(t.ch||0,micCh-1);
function updateMon(){if(!micSplit)return;tracks.forEach(t=>{try{micSplit.disconnect(t.in)}catch{}if(t.arm&&t.mon)micSplit.connect(t.in,chOf(t),0)})}
$('#dev').onchange=()=>setupMic().catch(e=>toast('erro no microfone'));
const cntOn=()=>$('#cnt').classList.contains('on');
$('#cnt').onclick=e=>e.currentTarget.classList.toggle('on');
function cancelCount(){counting=false;countOsc.forEach(o=>{try{o.stop()}catch{}});countOsc=[];ui()}
function addPrev(it){const lane=$('#lane'+it.t.id);if(!lane)return;const pv=document.createElement('div');pv.className='prev';pv.style.left=rec.from*pps+'px';lane.appendChild(pv);it.pv=pv}
async function startRec(){
  if(counting)return;
  const trs=tracks.filter(t=>t.arm);if(!trs.length)return toast('arme uma trilha com o botão R');
  try{await ac.resume();await setupMic();
    if(!worklet){await ac.audioWorklet.addModule(URL.createObjectURL(new Blob([WK],{type:'application/javascript'})));worklet=true;
      recZ=ac.createGain();recZ.gain.value=0;recZ.connect(ac.destination)}
  }catch(e){return toast('não consegui acessar o microfone')}
  if(playing)pause();
  if(cntOn()){
    counting=true;ui();toast('contagem…');const T0=ac.currentTime+.08,sp=spb();
    countOsc=[0,1,2,3].map(i=>click(T0+i*sp,i===0));
    await new Promise(r=>setTimeout(r,(.08+4*sp)*1000));
    if(!counting)return;counting=false;
  }
  const items=trs.map(t=>{const n=new AudioWorkletNode(ac,'rec'),it={t,n,chunks:[]};
    n.port.onmessage=e=>{if(recording)it.chunks.push(e.data)};micSplit.connect(n,chOf(t),0);n.connect(recZ);return it});
  recording=true;await play();
  const lat=(ac.baseLatency||0)+(ac.outputLatency||0)+(+$('#lat').value||0)/1000;
  rec={items,start:pos0+(ac.currentTime-t0)-lat,from:pos0};
  items.forEach(it=>{it.n.port.postMessage(true);addPrev(it)});
  ui();
}
function stopRec(){
  if(!recording)return;const R=rec;R.items.forEach(it=>it.n.port.postMessage(false));pause();recording=false;
  setTimeout(()=>{
    let pushed=false,last=null;
    R.items.forEach(it=>{
      try{it.n.disconnect();micSplit.disconnect(it.n)}catch{}
      const len=it.chunks.reduce((a,c)=>a+c.length,0);if(!len)return;
      let data=new Float32Array(len),o=0;it.chunks.forEach(c=>{data.set(c,o);o+=c.length});
      let start=R.start;if(start<0){const cut=Math.min(len-1,Math.round(-start*ac.sampleRate));data=data.subarray(cut);start=0}
      const b=ac.createBuffer(1,data.length,ac.sampleRate);b.copyToChannel(data,0);
      if(!pushed){pushUndo();pushed=true}
      const rt=it.t,ce=start+b.duration;
      if(rt.clips.some(c=>c.start<ce&&c.start+c.dur>start)){rt.takes.push([]);rt.ti=rt.takes.length-1;toast('take '+(rt.ti+1))}
      last=addClip(rt,b,start);
    });
    if(last)selClip=last;pos0=R.from;render();ui();
  },80);
}
$('#rc').onclick=()=>recording?stopRec():counting?cancelCount():startRec();
