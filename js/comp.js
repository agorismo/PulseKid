// pulsekid · editor visual do compressor: curva de transferência, nível ao vivo e medidor de redução de ganho
let cmpView=null;
/* mesma fórmula do worklet 'pk-comp' (plugins.js), mais o ganho de compensação */
function cmpOut(x,p){
  const T=p.threshold,R=p.ratio,W=p.knee;let y;
  if(2*(x-T)<-W)y=x;else if(W>0&&2*Math.abs(x-T)<=W){const d=x-T+W/2;y=x+(1/R-1)*d*d/(2*W)}else y=T+(x-T)/R;
  return y+p.makeup;
}
function openComp(f,o){
  const W=470,H=422,dpr=Math.min(2,window.devicePixelRatio||1),S=370,px0=40,py0=10,k=S/72,LO=-60,HI=12;
  $('#mtitle').textContent='compressor · '+(o.master?'master':o.name);
  $('#mbody').innerHTML='<div class="cmw"><canvas id="cmc"></canvas><div class="cmctl" id="cmctl"></div></div>';
  const cv=$('#cmc');cv.width=W*dpr;cv.height=H*dpr;
  cmpView={f,o,cv,W,H,dpr,S,px0,py0,k,LO,HI,lvl:-90,drag:null};
  const v=cmpView;
  v.X=db=>px0+(db-LO)*k;v.Y=db=>py0+(HI-db)*k;v.dbX=x=>(x-px0)/k+LO;v.dbY=y=>HI-(y-py0)/k;
  const pos=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height]};
  const handles=()=>{const p=f.p;return{t:[v.X(p.threshold),v.Y(cmpOut(p.threshold,p))],r:[v.X(0),v.Y(cmpOut(0,p))]}};
  cv.onpointerdown=e=>{const[x,y]=pos(e),h=handles();let best=16,hit=null;
    for(const id of['t','r']){const d=Math.hypot(h[id][0]-x,h[id][1]-y);if(d<best){best=d;hit=id}}
    if(hit){v.drag=hit;cv.setPointerCapture(e.pointerId)}};
  cv.onpointermove=e=>{
    if(!v.drag)return;const[x,y]=pos(e),p=f.p;
    if(v.drag==='t')p.threshold=Math.round(Math.max(-60,Math.min(-1,v.dbX(x))));
    else{const out=Math.min(0,v.dbY(y))-p.makeup,T=p.threshold;p.ratio=out<=T+.05?20:Math.max(1,Math.min(20,Math.round((0-T)/(out-T)*10)/10))}
    cmpPush();cmpSync();
  };
  cv.onpointerup=cv.onpointercancel=()=>{v.drag=null};
  $('#cmctl').innerHTML=PL.comp.params.map(q=>`<div class="pr"><span>${q.l}</span><input type="range" min="${q.min}" max="${q.max}" step="${q.s}" data-k="${q.k}"><em></em></div>`).join('')+
    '<div class="hint">arraste o ponto rosa (limiar) e o ponto amarelo (razão) · o ponto branco é o nível do áudio agora</div>';
  $('#cmctl').querySelectorAll('input').forEach(i=>i.oninput=()=>{f.p[i.dataset.k]=+i.value;cmpPush();cmpSync()});
  cmpSync();$('#modal').style.display='flex';requestAnimationFrame(cmpFrame);
}
function cmpPush(){const v=cmpView;if(!v||!v.f.inst)return;PL.comp.params.forEach(q=>v.f.inst.set(q.k,v.f.p[q.k]))}
function cmpSync(){
  const v=cmpView;if(!v)return;
  $('#cmctl').querySelectorAll('input').forEach(i=>{const q=PL.comp.params.find(x=>x.k===i.dataset.k),val=v.f.p[q.k];i.value=val;i.nextElementSibling.textContent=fmtv(q,val)});
}
function cmpFrame(){
  const v=cmpView;
  if(!v||$('#modal').style.display!=='flex'||!document.body.contains(v.cv)){cmpView=null;return}
  const x=v.cv.getContext('2d'),{W,H,dpr,S,px0,py0,LO,HI}=v,p=v.f.p,inst=v.f.inst;
  x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);x.lineWidth=1;x.font='10px ui-monospace,monospace';x.textAlign='left';x.textBaseline='top';
  for(let g=LO;g<=HI;g+=12){
    x.strokeStyle=g===0?'#2e2e36':'#1a1a20';x.beginPath();x.moveTo(v.X(g),py0);x.lineTo(v.X(g),py0+S);x.moveTo(px0,v.Y(g));x.lineTo(px0+S,v.Y(g));x.stroke();
    x.fillStyle='#6b6b76';x.textAlign='center';x.fillText(g,v.X(g),py0+S+4);x.textAlign='right';x.fillText(g,px0-5,v.Y(g)-5);
  }
  x.textAlign='left';x.fillStyle='#55555e';x.fillText('entrada (dB)',px0+S-70,py0+S-14);x.fillText('saída',px0+4,py0+2);
  x.setLineDash([4,4]);x.strokeStyle='#33333b';x.beginPath();x.moveTo(v.X(LO),v.Y(LO));x.lineTo(v.X(HI),v.Y(HI));x.stroke();x.setLineDash([]);
  // curva de transferência
  x.beginPath();for(let d=LO;d<=HI;d+=.5){const yy=Math.max(py0,Math.min(py0+S,v.Y(cmpOut(d,p))));d===LO?x.moveTo(v.X(d),yy):x.lineTo(v.X(d),yy)}
  x.strokeStyle=v.f.bypass?'#6b6b76':'#e8e8ec';x.lineWidth=2;x.stroke();
  // nível ao vivo (pico) e ponto de operação
  if(inst&&inst.an){
    const b=v.buf||(v.buf=new Float32Array(inst.an.fftSize));inst.an.getFloatTimeDomainData(b);let pk=0;for(let i=0;i<b.length;i++){const a=Math.abs(b[i]);if(a>pk)pk=a}
    const db=Math.max(LO,Math.min(HI,20*Math.log10(Math.max(pk,1e-6))));v.lvl=db>v.lvl?db:v.lvl*.9+db*.1;
    const cx=v.X(v.lvl),cy=Math.max(py0,Math.min(py0+S,v.Y(cmpOut(v.lvl,p))));
    x.strokeStyle='rgba(255,255,255,.18)';x.lineWidth=1;x.beginPath();x.moveTo(cx,py0+S);x.lineTo(cx,cy);x.lineTo(px0,cy);x.stroke();
    x.beginPath();x.arc(cx,cy,5,0,7);x.fillStyle='#fff';x.fill();
  }
  // pontos de edição
  const T=p.threshold,pts=[[T,'#ff8fa3'],[0,'#ffb703']];
  pts.forEach(([d,c])=>{const px=v.X(d),py=Math.max(py0,Math.min(py0+S,v.Y(cmpOut(d,p))));x.beginPath();x.arc(px,py,8,0,7);x.fillStyle=c;x.fill();x.strokeStyle='#000';x.lineWidth=2;x.stroke()});
  // medidor de redução de ganho
  const mx=px0+S+22,mw=24,gr=inst?Math.min(0,inst.gr||0):0,fill=Math.min(1,-gr/24)*S;
  x.strokeStyle='#222228';x.lineWidth=1;x.strokeRect(mx,py0,mw,S);x.fillStyle='#ffb703';x.fillRect(mx+1,py0+1,mw-2,Math.max(0,fill-1));
  x.fillStyle='#6b6b76';x.textAlign='center';x.fillText('GR',mx+mw/2,py0+S+4);x.fillStyle='#e8e8ec';x.fillText(gr.toFixed(1),mx+mw/2,py0+S+16);
  requestAnimationFrame(cmpFrame);
}
$('#mclose').addEventListener('click',()=>{if(cmpView){cmpView=null;renderFx()}});
