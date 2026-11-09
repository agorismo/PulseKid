// pulsekid · EQ visual: 6 bandas paramétricas com curva editável e analisador de espectro
const PEQ_TYPES=[['peaking','sino'],['lowshelf','shelf grave'],['highshelf','shelf agudo'],['highpass','passa-alta'],['lowpass','passa-baixa'],['notch','notch']];
const PEQ_COLORS=['#ff8fa3','#ffb703','#8be28b','#5cc8ff','#b79cff','#ff7ad9'];
const peqDefault=()=>[
  {on:true,type:'lowshelf',f:80,g:0,q:.7},{on:true,type:'peaking',f:250,g:0,q:1},{on:true,type:'peaking',f:800,g:0,q:1},
  {on:true,type:'peaking',f:2500,g:0,q:1},{on:true,type:'peaking',f:6000,g:0,q:1},{on:true,type:'highshelf',f:10000,g:0,q:.7}];
const PEQ_PRESETS={
  'plano':()=>peqDefault(),
  'voz limpa':()=>{const b=peqDefault();Object.assign(b[0],{type:'highpass',f:90,q:.7});Object.assign(b[1],{f:300,g:-3});Object.assign(b[3],{f:3000,g:2.5});Object.assign(b[5],{f:10000,g:3});return b},
  'presença e ar':()=>{const b=peqDefault();Object.assign(b[3],{f:2800,g:3});Object.assign(b[5],{f:12000,g:4});return b},
  'quente':()=>{const b=peqDefault();Object.assign(b[0],{f:100,g:3});Object.assign(b[1],{f:250,g:1.5});Object.assign(b[5],{f:9000,g:-3});return b},
  'corta grave':()=>{const b=peqDefault();Object.assign(b[0],{type:'highpass',f:80,q:.7});return b}};
const peqHasGain=t=>t==='peaking'||t==='lowshelf'||t==='highshelf';
function peqApply(n,b){
  if(!b.on){n.type='peaking';n.frequency.value=1000;n.gain.value=0;n.Q.value=1;return}
  n.type=b.type;n.frequency.value=b.f;n.Q.value=b.q;n.gain.value=peqHasGain(b.type)?b.g:0;
}
PL.peq={name:'EQ visual',custom:true,params:[],init:()=>({b:peqDefault()}),
  make(c,f){
    const bands=f&&f.p&&f.p.b?f.p.b:peqDefault(),nodes=bands.map(()=>c.createBiquadFilter()),i=c.createGain(),o=c.createGain();
    let prev=i;nodes.forEach((n,k)=>{peqApply(n,bands[k]);prev.connect(n);prev=n});prev.connect(o);
    let an=null;if(c===ac){an=c.createAnalyser();an.fftSize=4096;an.smoothingTimeConstant=.82;o.connect(an)}
    return{in:i,out:o,an,set(){},upd(b){b.forEach((x,k)=>nodes[k]&&peqApply(nodes[k],x))},stop(){}};
  }};

/* resposta em frequência combinada (dB) de todas as bandas ligadas */
const PEQ_FR=(()=>{const n=320,f=new Float32Array(n);for(let i=0;i<n;i++)f[i]=20*Math.pow(1000,i/(n-1));return f})();
let peqTmp=null;
function peqResp(bands){
  peqTmp=peqTmp||ac.createBiquadFilter();
  const n=PEQ_FR.length,mag=new Float32Array(n),ph=new Float32Array(n),tot=new Float32Array(n);
  bands.forEach(b=>{if(!b.on)return;
    peqTmp.type=b.type;peqTmp.frequency.value=b.f;peqTmp.Q.value=b.q;peqTmp.gain.value=peqHasGain(b.type)?b.g:0;
    peqTmp.getFrequencyResponse(PEQ_FR,mag,ph);for(let i=0;i<n;i++)tot[i]+=20*Math.log10(Math.max(mag[i],1e-6))});
  return tot;
}
/* miniatura da curva dentro do cartão do rack */
function peqMini(cv,bands,off){
  const x=cv.getContext('2d'),W=cv.width,H=cv.height,r=peqResp(bands);x.clearRect(0,0,W,H);
  x.strokeStyle='#222228';x.lineWidth=1;x.beginPath();x.moveTo(0,H/2);x.lineTo(W,H/2);x.stroke();
  x.strokeStyle=off?'#55555e':'#ff8fa3';x.lineWidth=2.5;x.beginPath();
  r.forEach((v,i)=>{const px=i/(r.length-1)*W,py=H/2-Math.max(-18,Math.min(18,v))/18*(H/2-6);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke();
}

/* ---------- editor ---------- */
let eqView=null;
const EQX=(f,W)=>Math.log(f/20)/Math.log(1000)*W, EQF=(x,W)=>20*Math.pow(1000,x/W);
const eqY=g=>eqView.H/2-g/eqView.range*(eqView.H/2-10), eqG=y=>(eqView.H/2-y)/(eqView.H/2-10)*eqView.range;
const eqPX=b=>EQX(b.f,eqView.W), eqPY=b=>eqY(peqHasGain(b.type)?b.g:0);
const eqChanged=()=>{const f=eqView.f;f.inst&&f.inst.upd&&f.inst.upd(f.p.b)};
const eqBand=()=>eqView.f.p.b[eqView.sel];
function eqHit(x,y){let hit=-1,best=14;eqView.f.p.b.forEach((b,k)=>{const d=Math.hypot(eqPX(b)-x,eqPY(b)-y);if(d<best){best=d;hit=k}});return hit}

function openEq(f,o){
  const W=720,H=320,dpr=Math.min(2,window.devicePixelRatio||1);
  $('#mtitle').textContent='EQ visual · '+(o.master?'master':o.name);
  $('#mbody').innerHTML='<div class="eqw"><canvas id="eqc"></canvas><div class="eqc" id="eqctl"></div></div>';
  const cv=$('#eqc');cv.width=W*dpr;cv.height=H*dpr;
  eqView={f,o,cv,W,H,dpr,sel:0,drag:false,range:18,spec:null};
  const pos=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height]};
  cv.onpointerdown=e=>{const[x,y]=pos(e),k=eqHit(x,y);if(k<0)return;eqView.sel=k;eqView.drag=true;cv.setPointerCapture(e.pointerId);eqBuildCtl()};
  cv.onpointermove=e=>{
    if(!eqView.drag)return;const[x,y]=pos(e),b=eqBand();
    b.f=Math.round(Math.max(20,Math.min(20000,EQF(Math.max(0,Math.min(W,x)),W))));
    if(peqHasGain(b.type))b.g=Math.round(Math.max(-eqView.range,Math.min(eqView.range,eqG(y)))*2)/2;
    eqChanged();eqSyncCtl();
  };
  cv.onpointerup=cv.onpointercancel=()=>{eqView&&(eqView.drag=false)};
  cv.ondblclick=e=>{const[x,y]=pos(e),k=eqHit(x,y);if(k<0)return;eqView.sel=k;const b=eqBand();b.on=!b.on;eqChanged();eqBuildCtl()};
  cv.addEventListener('wheel',e=>{e.preventDefault();const b=eqBand();b.q=Math.max(.1,Math.min(18,+(b.q*(e.deltaY<0?1.12:1/1.12)).toFixed(2)));eqChanged();eqSyncCtl()},{passive:false});
  $('#modal').style.display='flex';eqBuildCtl();requestAnimationFrame(eqFrame);
}
function eqBuildCtl(){
  const v=eqView,box=$('#eqctl');if(!v||!box)return;
  box.innerHTML=`<span id="eqn" style="font-weight:700"></span>
    <select id="eqt">${PEQ_TYPES.map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select>
    <label>freq <input id="eqf" type="number" min="20" max="20000" step="1"> Hz</label>
    <label>ganho <input id="eqg" type="number" step=".5"> dB</label>
    <label>Q <input id="eqq" type="number" min=".1" max="18" step=".1"></label>
    <button id="eqon"></button>
    <select id="eqp"><option value="">preset…</option>${Object.keys(PEQ_PRESETS).map(k=>`<option>${k}</option>`).join('')}</select>
    <select id="eqr" title="escala vertical">${[6,12,18,24].map(r=>`<option value="${r}"${r===v.range?' selected':''}>±${r} dB</option>`).join('')}</select>
    <div class="hint">arraste os pontos · roda do mouse muda o Q · duplo clique liga/desliga a banda</div>`;
  const num=(id,fn)=>{$(id).oninput=e=>{const x=parseFloat(e.target.value);if(isNaN(x))return;fn(eqBand(),x);eqChanged()}};
  $('#eqt').onchange=e=>{const b=eqBand();b.type=e.target.value;if(!peqHasGain(b.type))b.g=0;eqChanged();eqSyncCtl()};
  num('#eqf',(b,x)=>b.f=Math.max(20,Math.min(20000,x)));
  num('#eqg',(b,x)=>b.g=Math.max(-24,Math.min(24,x)));
  num('#eqq',(b,x)=>b.q=Math.max(.1,Math.min(18,x)));
  $('#eqon').onclick=()=>{const b=eqBand();b.on=!b.on;eqChanged();eqSyncCtl()};
  $('#eqp').onchange=e=>{const p=PEQ_PRESETS[e.target.value];if(!p)return;v.f.p.b=p();eqChanged();eqBuildCtl()};
  $('#eqr').onchange=e=>{v.range=+e.target.value};
  eqSyncCtl();
}
function eqSyncCtl(){
  const v=eqView;if(!v||!$('#eqn'))return;const b=eqBand(),act=document.activeElement&&document.activeElement.id;
  $('#eqn').textContent='banda '+(v.sel+1);$('#eqn').style.color=PEQ_COLORS[v.sel];
  $('#eqt').value=b.type;
  if(act!=='eqf')$('#eqf').value=b.f;if(act!=='eqg')$('#eqg').value=peqHasGain(b.type)?b.g:0;if(act!=='eqq')$('#eqq').value=b.q;
  $('#eqg').disabled=!peqHasGain(b.type);
  $('#eqon').textContent=b.on?'ligada':'desligada';$('#eqon').classList.toggle('on',b.on);
}
function eqFrame(){
  const v=eqView;
  if(!v||$('#modal').style.display!=='flex'||!document.body.contains(v.cv)){eqView=null;return}
  const x=v.cv.getContext('2d'),{W,H,dpr}=v;x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);x.textAlign='left';x.textBaseline='top';x.lineWidth=1;x.font='10px ui-monospace,monospace';
  const gs=v.range<=6?2:v.range<=12?3:6;
  for(let g=-v.range;g<=v.range;g+=gs){const py=eqY(g);x.strokeStyle=g===0?'#2e2e36':'#17171c';x.beginPath();x.moveTo(0,py);x.lineTo(W,py);x.stroke();if(g>-v.range){x.fillStyle='#55555e';x.fillText((g>0?'+':'')+g,3,py+2)}}
  [20,50,100,200,500,1000,2000,5000,10000,20000].forEach(fr=>{const px=EQX(fr,W);x.strokeStyle='#1c1c22';x.beginPath();x.moveTo(px,0);x.lineTo(px,H);x.stroke();x.fillStyle='#6b6b76';x.fillText(fr>=1000?fr/1000+'k':fr,Math.min(px+3,W-24),H-13)});
  const an=v.f.inst&&v.f.inst.an;
  if(an){
    const N=an.frequencyBinCount,d=v.spec||(v.spec=new Float32Array(N)),sr=ac.sampleRate;an.getFloatFrequencyData(d);
    x.beginPath();x.moveTo(0,H);
    for(let px=0;px<=W;px+=2){const k=Math.min(N-1,Math.round(EQF(px,W)/(sr/2)*N));let db=d[k];if(!isFinite(db))db=-120;x.lineTo(px,H-Math.max(0,Math.min(1,(db+90)/80))*H*.85)}
    x.lineTo(W,H);x.closePath();x.fillStyle='rgba(255,143,163,.14)';x.fill();
  }
  const r=peqResp(v.f.p.b);x.beginPath();
  r.forEach((db,i)=>{const px=i/(r.length-1)*W,py=Math.max(1,Math.min(H-1,eqY(db)));i?x.lineTo(px,py):x.moveTo(px,py)});
  x.strokeStyle=v.f.bypass?'#6b6b76':'#e8e8ec';x.lineWidth=2;x.stroke();
  v.f.p.b.forEach((b,k)=>{
    const px=eqPX(b),py=eqPY(b);x.beginPath();x.arc(px,py,k===v.sel?9:7,0,7);
    x.globalAlpha=b.on?1:.45;x.fillStyle=b.on?PEQ_COLORS[k]:'#44444c';x.fill();x.globalAlpha=1;
    if(k===v.sel){x.strokeStyle='#fff';x.lineWidth=2;x.stroke()}
    x.fillStyle='#000';x.font='bold 9px ui-monospace,monospace';x.textAlign='center';x.textBaseline='middle';x.fillText(k+1,px,py+.5);
  });
  requestAnimationFrame(eqFrame);
}
$('#mclose').addEventListener('click',()=>{if(eqView){eqView=null;renderFx()}});
