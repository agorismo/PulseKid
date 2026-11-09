// pulsekid · reverb: resposta ao impulso determinística (mesmo ruído, só o envelope muda) e editor visual
/* duas bandas com decaimento próprio: graves/médios (RT60 = tamanho) e agudos (decaem mais rápido conforme 'abafar') */
function reverbGen(sr,size,damp){
  const n=Math.max(64,Math.floor(sr*size*1.15)),out=[new Float32Array(n),new Float32Array(n)];
  const rtL=size,rtH=Math.max(.05,size*(1-.8*damp)),a=1-Math.exp(-2*Math.PI*3000/sr),fade=Math.max(1,Math.floor(sr*.004));
  const fL=Math.pow(10,-3/(rtL*sr)),fH=Math.pow(10,-3/(rtH*sr));
  [1234567,7654321].forEach((seed,ch)=>{
    let t=seed>>>0,lp=0,gL=1,gH=1;const d=out[ch];
    for(let i=0;i<n;i++){
      t=(t+0x6D2B79F5)>>>0;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);
      const x=((r^(r>>>14))>>>0)/4294967296*2-1;lp+=a*(x-lp);const hi=x-lp;
      d[i]=(1.8*lp*gL+.55*hi*gH)*(i<fade?i/fade:1);gL*=fL;gH*=fH;
    }
  });
  return out;
}
const _irCache=new Map();
function reverbIR(c,size,damp){
  const sr=c.sampleRate,key=sr+'|'+size.toFixed(2)+'|'+damp.toFixed(2);let b=_irCache.get(key);if(b)return b;
  const g=reverbGen(sr,size,damp);b=c.createBuffer(2,g[0].length,sr);b.copyToChannel(g[0],0);b.copyToChannel(g[1],1);
  _irCache.set(key,b);if(_irCache.size>10)_irCache.delete(_irCache.keys().next().value);return b;
}

/* ---------- editor ---------- */
const RV_PRESETS={
  'quarto':{size:.5,pre:2,damp:.5,lowcut:100,mix:.2},'sala':{size:1.2,pre:10,damp:.4,lowcut:100,mix:.25},
  'vocal':{size:1.4,pre:30,damp:.45,lowcut:150,mix:.22},'hall':{size:2.4,pre:25,damp:.35,lowcut:100,mix:.28},
  'placa':{size:1.8,pre:0,damp:.1,lowcut:150,mix:.3},'catedral':{size:5,pre:40,damp:.25,lowcut:120,mix:.3}};
let rvView=null;
function openReverb(f,o){
  const W=620,H=330,dpr=Math.min(2,window.devicePixelRatio||1),L=44,R=14,T=14,B=26,TMAX=7;
  $('#mtitle').textContent='reverb · '+(o.master?'master':o.name);
  $('#mbody').innerHTML='<div class="rvw"><canvas id="rvc"></canvas><div class="rvctl" id="rvctl"></div></div>';
  const cv=$('#rvc');cv.width=W*dpr;cv.height=H*dpr;
  const v=rvView={f,o,cv,W,H,dpr,L,R,T,B,TMAX,drag:null};
  v.X=t=>L+t/TMAX*(W-L-R);v.tX=x=>(x-L)/(W-L-R)*TMAX;v.Y=db=>T+(-db)/60*(H-T-B);
  const pos=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height]};
  const hs=()=>{const p=f.p;return{r:[v.X(p.pre/1000+p.size),v.Y(-60)],p:[v.X(p.pre/1000),v.Y(0)]}};
  cv.onpointerdown=e=>{const[x,y]=pos(e),h=hs();let best=16,hit=null;
    for(const id of['r','p']){const d=Math.hypot(h[id][0]-x,h[id][1]-y);if(d<best){best=d;hit=id}}
    if(hit){v.drag=hit;cv.setPointerCapture(e.pointerId)}};
  cv.onpointermove=e=>{
    if(!v.drag)return;const[x]=pos(e),p=f.p,t=Math.max(0,v.tX(x));
    if(v.drag==='p'){p.pre=Math.round(Math.max(0,Math.min(200,t*1000)));rvPush(['pre'])}
    else{p.size=Math.round(Math.max(.2,Math.min(6,t-p.pre/1000))*20)/20;rvPush(['size'])}
    rvSync();rvDraw();
  };
  cv.onpointerup=cv.onpointercancel=()=>{v.drag=null};
  $('#rvctl').innerHTML='<div class="pr"><span>sala</span><select id="rvp"><option value="">preset…</option>'+Object.keys(RV_PRESETS).map(k=>`<option>${k}</option>`).join('')+'</select><em></em></div>'+
    PL.reverb.params.map(q=>`<div class="pr"><span>${q.l}</span><input type="range" min="${q.min}" max="${q.max}" step="${q.s}" data-k="${q.k}"><em></em></div>`).join('')+
    '<div class="hint">arraste o ponto amarelo (tamanho/RT60) e o ponto rosa (pré-delay) · a curva rosa mostra os agudos decaindo mais rápido</div>';
  $('#rvctl').querySelectorAll('input').forEach(i=>i.oninput=()=>{f.p[i.dataset.k]=+i.value;rvPush([i.dataset.k]);rvSync();rvDraw()});
  $('#rvp').onchange=e=>{const p=RV_PRESETS[e.target.value];if(!p)return;Object.assign(f.p,p);rvPush(Object.keys(p));rvSync();rvDraw();e.target.value=''};
  rvSync();$('#modal').style.display='flex';rvDraw();
}
function rvPush(keys){const v=rvView;if(!v||!v.f.inst)return;keys.forEach(k=>v.f.inst.set(k,v.f.p[k]))}
function rvSync(){
  const v=rvView;if(!v)return;
  $('#rvctl').querySelectorAll('input').forEach(i=>{const q=PL.reverb.params.find(x=>x.k===i.dataset.k),val=v.f.p[q.k];i.value=val;i.nextElementSibling.textContent=fmtv(q,val)});
}
function rvDraw(){
  const v=rvView;if(!v||!document.body.contains(v.cv))return;
  const x=v.cv.getContext('2d'),{W,H,dpr,L,R,T,B,TMAX}=v,p=v.f.p,pw=W-L-R,ph=H-T-B;
  x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);x.lineWidth=1;x.font='10px ui-monospace,monospace';x.textBaseline='top';
  for(let t=0;t<=TMAX;t++){x.strokeStyle='#1a1a20';x.beginPath();x.moveTo(v.X(t),T);x.lineTo(v.X(t),T+ph);x.stroke();x.fillStyle='#6b6b76';x.textAlign='center';x.fillText(t+'s',v.X(t),T+ph+6)}
  for(let g=0;g>=-60;g-=20){x.strokeStyle=g===0?'#2e2e36':'#1a1a20';x.beginPath();x.moveTo(L,v.Y(g));x.lineTo(L+pw,v.Y(g));x.stroke();x.fillStyle='#6b6b76';x.textAlign='right';x.fillText(g+' dB',L-5,v.Y(g)-5)}
  // resposta ao impulso real (picos por coluna, em dB, normalizada)
  const buf=reverbIR(ac,p.size,p.damp),d=buf.getChannelData(0),sr=buf.sampleRate;let mx=1e-9;for(let i=0;i<d.length;i+=7)mx=Math.max(mx,Math.abs(d[i]));
  x.beginPath();x.moveTo(v.X(p.pre/1000),T+ph);
  for(let px=0;px<=pw;px++){const t0=v.tX(L+px)-p.pre/1000,t1=v.tX(L+px+1)-p.pre/1000;let pk=0;
    if(t1>0){for(let i=Math.max(0,Math.floor(t0*sr)),e=Math.min(d.length,Math.ceil(t1*sr));i<e;i++){const a=Math.abs(d[i]);if(a>pk)pk=a}}
    const db=Math.max(-60,20*Math.log10(Math.max(pk,1e-9)/mx));if(L+px>=v.X(p.pre/1000))x.lineTo(L+px,v.Y(db))}
  x.lineTo(L+pw,T+ph);x.closePath();x.fillStyle='rgba(255,143,163,.16)';x.fill();
  // decaimentos ideais: médios/graves (RT60) e agudos
  const rtH=Math.max(.05,p.size*(1-.8*p.damp)),x0=v.X(p.pre/1000);
  x.lineWidth=2;x.strokeStyle='#ffb703';x.beginPath();x.moveTo(x0,v.Y(0));x.lineTo(v.X(p.pre/1000+p.size),v.Y(-60));x.stroke();
  x.strokeStyle='#ff8fa3';x.beginPath();x.moveTo(x0,v.Y(0));x.lineTo(v.X(p.pre/1000+rtH),v.Y(-60));x.stroke();
  // pré-delay e pontos
  if(p.pre>0){x.fillStyle='#6b6b76';x.fillRect(v.X(0),v.Y(0)-1,x0-v.X(0),2)}
  [[p.pre/1000,0,'#ff8fa3'],[p.pre/1000+p.size,-60,'#ffb703']].forEach(([t,db,c])=>{x.beginPath();x.arc(v.X(t),v.Y(db),8,0,7);x.fillStyle=c;x.fill();x.strokeStyle='#000';x.lineWidth=2;x.stroke()});
  x.fillStyle='#e8e8ec';x.textAlign='left';x.fillText('RT60 '+p.size.toFixed(2)+' s',Math.min(L+pw-90,v.X(p.pre/1000+p.size)+12),v.Y(-60)-18);
  x.fillStyle='#6b6b76';x.fillText('pré '+p.pre+' ms',x0+12,v.Y(0)+6);
}
$('#mclose').addEventListener('click',()=>{if(rvView){rvView=null;renderFx()}});
