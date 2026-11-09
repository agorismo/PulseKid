// pulsekid · delay: sincronia com o bpm, ping-pong, filtro de tom no feedback e editor visual
const DLY_DIV=[['1/16T',1/6],['1/16',.25],['1/8T',1/3],['1/16.',.375],['1/8',.5],['1/4T',2/3],['1/8.',.75],['1/4',1],['1/2T',4/3],['1/4.',1.5],['1/2',2],['1/2.',3],['1/1',4]];
/* tempo do eco em segundos: livre, ou a divisão escolhida no bpm atual */
const dlyTime=p=>p.sync?DLY_DIV[Math.max(0,Math.min(12,Math.round(p.div)))][1]*spb():p.time;

PL.delay={name:'delay',editor:(f,o)=>openDelay(f,o),
  params:[P('time','tempo',.02,2,.3,.01,'s'),P('sync','sync',0,1,0,1,'',['livre','bpm']),P('div','divisão',0,12,4,1,'',DLY_DIV.map(d=>d[0])),
    P('fb','feedback',0,.95,.35,.01),P('tone','tom',500,16000,6000,100,'hz'),P('pp','estéreo',0,1,0,1,'',['mono','ping']),P('mix','mix',0,1,.3,.01)],
  make(c){
    const i=c.createGain(),o=c.createGain(),d=c.createGain(),w=c.createGain(),d1=c.createDelay(5),d2=c.createDelay(5),
      g12=c.createGain(),fbN=c.createGain(),fbP=c.createGain(),lp1=c.createBiquadFilter(),lp2=c.createBiquadFilter(),m=c.createChannelMerger(2),
      oL1=c.createGain(),oR1=c.createGain(),oR2=c.createGain();
    lp1.type=lp2.type='lowpass';
    i.connect(d);d.connect(o);i.connect(d1);
    d1.connect(lp1);lp1.connect(fbN);fbN.connect(d1);lp1.connect(g12);g12.connect(d2);d2.connect(lp2);lp2.connect(fbP);fbP.connect(d1);
    d1.connect(oL1);oL1.connect(m,0,0);d1.connect(oR1);oR1.connect(m,0,1);d2.connect(oR2);oR2.connect(m,0,1);
    m.connect(w);w.connect(o);
    const st={time:.3,sync:0,div:4,fb:.35,pp:0};
    const apply=()=>{
      const T=Math.max(.01,Math.min(4.9,dlyTime(st)));d1.delayTime.value=T;d2.delayTime.value=T;
      fbN.gain.value=st.pp?0:st.fb;fbP.gain.value=st.pp?st.fb:0;g12.gain.value=st.pp?st.fb:0;
      oL1.gain.value=1;oR1.gain.value=st.pp?0:1;oR2.gain.value=st.pp?1:0;
    };
    apply();
    return{in:i,out:o,set:(k,v)=>{
      if(k in st){st[k]=v;apply()}
      if(k==='tone'){lp1.frequency.value=v;lp2.frequency.value=v}
      if(k==='mix'){d.gain.value=1-v*.5;w.gain.value=v}}};
  }};
/* quando o bpm muda, os delays sincronizados recalculam o tempo */
function delaySyncAll(){
  [...tracks,M].forEach(o=>o.fx.forEach(f=>{if(f.type==='delay'&&f.p.sync&&f.inst)f.inst.set('time',f.p.time)}));
  if(dlView){dlView.tmax=dlAxis(dlView.f.p);dlDraw()}
}
$('#bpm').addEventListener('input',delaySyncAll);$('#bpm').addEventListener('change',delaySyncAll);

/* ---------- editor ---------- */
let dlView=null;
/* nível de cada eco em dB relativo ao som seco (o seco vale 0 dB) */
function dlLevels(p){
  const r=p.mix/(1-p.mix/2),L1=20*Math.log10(Math.max(r,1e-4)),per=20*Math.log10(Math.max(p.fb,1e-4)),out=[];
  for(let n=0;n<64;n++){const l=L1+n*per;if(l<-60)break;out.push(l)}
  return out;
}
function dlAxis(p){return Math.max(2,Math.min(8,Math.ceil(dlyTime(p)*(Math.min(dlLevels(p).length,10)+1)*2)/2))}
function openDelay(f,o){
  const W=620,H=330,dpr=Math.min(2,window.devicePixelRatio||1),L=44,R=14,T=14,B=26;
  $('#mtitle').textContent='delay · '+(o.master?'master':o.name);
  $('#mbody').innerHTML='<div class="dlw"><canvas id="dlc"></canvas><div class="dlctl" id="dlctl"></div></div>';
  const cv=$('#dlc');cv.width=W*dpr;cv.height=H*dpr;
  const v=dlView={f,o,cv,W,H,dpr,L,R,T,B,drag:null,tmax:dlAxis(f.p)};
  v.X=t=>L+t/v.tmax*(W-L-R);v.tX=x=>(x-L)/(W-L-R)*v.tmax;v.Y=db=>T+(6-db)/66*(H-T-B);v.dbY=y=>6-(y-T)/(H-T-B)*66;
  const pos=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height]};
  const hs=()=>{const p=f.p,lv=dlLevels(p),t=dlyTime(p),h={};
    h.e1=[v.X(t),v.Y(Math.max(-60,Math.min(6,lv[0]!==undefined?lv[0]:-60)))];
    if(p.fb>.002)h.e2=[v.X(2*t),v.Y(Math.max(-60,lv[1]!==undefined?lv[1]:-60))];return h};
  cv.onpointerdown=e=>{const[x,y]=pos(e),h=hs();let best=16,hit=null;
    for(const id in h){const d=Math.hypot(h[id][0]-x,h[id][1]-y);if(d<best){best=d;hit=id}}
    if(hit){v.drag=hit;cv.setPointerCapture(e.pointerId)}};
  cv.onpointermove=e=>{
    if(!v.drag)return;const[x,y]=pos(e),p=f.p,keys=[];
    if(v.drag==='e1'){
      const t=Math.max(.01,v.tX(Math.max(L,Math.min(W-R,x))));
      if(p.sync){const bt=t/spb();let bi=0;DLY_DIV.forEach((d,i)=>{if(Math.abs(d[1]-bt)<Math.abs(DLY_DIV[bi][1]-bt))bi=i});p.div=bi;keys.push('div')}
      else{p.time=Math.round(Math.max(.02,Math.min(2,t))*1000)/1000;keys.push('time')}
      const r=Math.pow(10,Math.max(-60,Math.min(6,v.dbY(y)))/20);p.mix=Math.round(Math.max(0,Math.min(1,r/(1+r/2)))*100)/100;keys.push('mix');
    }else{
      const l1=dlLevels(p)[0];if(l1===undefined)return;
      p.fb=Math.round(Math.max(0,Math.min(.95,Math.pow(10,(v.dbY(y)-l1)/20)))*100)/100;keys.push('fb');
    }
    dlPush(keys);dlSync();dlDraw();
  };
  cv.onpointerup=cv.onpointercancel=()=>{v.drag=null;v.tmax=dlAxis(f.p);dlDraw()};
  $('#dlctl').innerHTML=PL.delay.params.map(q=>`<div class="pr"><span>${q.l}</span><input type="range" min="${q.min}" max="${q.max}" step="${q.s}" data-k="${q.k}"><em></em></div>`).join('')+
    '<div class="hint">1º eco: horizontal = tempo (encaixa na divisão quando sync está em bpm), vertical = mix · 2º eco: vertical = feedback</div>';
  $('#dlctl').querySelectorAll('input').forEach(i=>i.oninput=()=>{f.p[i.dataset.k]=+i.value;dlPush([i.dataset.k]);dlSync();v.tmax=dlAxis(f.p);dlDraw()});
  dlSync();$('#modal').style.display='flex';dlDraw();
}
function dlPush(keys){const v=dlView;if(!v||!v.f.inst)return;keys.forEach(k=>v.f.inst.set(k,v.f.p[k]));if(v.f.p.sync)v.f.inst.set('time',v.f.p.time)}
function dlSync(){
  const v=dlView;if(!v)return;
  $('#dlctl').querySelectorAll('input').forEach(i=>{const q=PL.delay.params.find(x=>x.k===i.dataset.k),val=v.f.p[q.k];i.value=val;i.nextElementSibling.textContent=fmtv(q,val);
    if(q.k==='time')i.parentElement.style.opacity=v.f.p.sync?.4:1;if(q.k==='div')i.parentElement.style.opacity=v.f.p.sync?1:.4});
}
function dlDraw(){
  const v=dlView;if(!v||!document.body.contains(v.cv))return;
  const x=v.cv.getContext('2d'),{W,H,dpr,L,R,T,B}=v,p=v.f.p,pw=W-L-R,ph=H-T-B,bs=spb(),tm=dlyTime(p),lv=dlLevels(p);
  x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);x.lineWidth=1;x.font='10px ui-monospace,monospace';x.textBaseline='top';
  // grade do projeto: batidas (e meias batidas), compassos numerados
  for(let b=0;b*bs/2<=v.tmax+1e-6;b++){const t=b*bs/2,px=v.X(t),beat=b%2===0,bar=b%8===0;
    x.strokeStyle=bar?'#2e2e36':beat?'#1d1d23':'#141418';x.beginPath();x.moveTo(px,T);x.lineTo(px,T+ph);x.stroke();
    if(bar){x.fillStyle='#6b6b76';x.textAlign='center';x.fillText(String(b/8+1),px,T+ph+6)}}
  x.fillStyle='#55555e';x.textAlign='right';x.fillText('compasso',L+pw,T+ph+6);
  for(let g=0;g>=-60;g-=20){x.strokeStyle=g===0?'#2e2e36':'#1a1a20';x.beginPath();x.moveTo(L,v.Y(g));x.lineTo(L+pw,v.Y(g));x.stroke();x.fillStyle='#6b6b76';x.textAlign='right';x.fillText(g+' dB',L-5,v.Y(g)-5)}
  // som seco e ecos
  x.fillStyle='#e8e8ec';x.fillRect(L,v.Y(0),4,T+ph-v.Y(0));
  lv.forEach((l,n)=>{const px=v.X((n+1)*tm);if(px>L+pw+4)return;const y=v.Y(Math.min(6,l));
    x.fillStyle=p.pp?(n%2===0?'#ffb703':'#ff8fa3'):'#ffb703';x.globalAlpha=Math.max(.35,1-n*.04);x.fillRect(px-3,y,6,T+ph-y);x.globalAlpha=1;
    if(p.pp&&n<8){x.fillStyle='#6b6b76';x.textAlign='center';x.fillText(n%2===0?'E':'D',px,y-26)}});
  // pontos de edição
  const h1=[v.X(tm),v.Y(Math.max(-60,Math.min(6,lv[0]!==undefined?lv[0]:-60)))];
  const pts=[[h1,'#ffb703']];if(p.fb>.002)pts.push([[v.X(2*tm),v.Y(Math.max(-60,lv[1]!==undefined?lv[1]:-60))],'#ff8fa3']);
  pts.forEach(([[px,py],c])=>{if(px>L+pw+8)return;x.beginPath();x.arc(px,py,8,0,7);x.fillStyle=c;x.fill();x.strokeStyle='#000';x.lineWidth=2;x.stroke()});
  x.fillStyle='#e8e8ec';x.textAlign='left';x.fillText('eco a cada '+Math.round(tm*1000)+' ms'+(p.sync?' ('+DLY_DIV[Math.round(p.div)][0]+' a '+Math.round(60/bs)+' bpm)':''),L+8,T+4);
  x.fillStyle='#6b6b76';x.fillText('seco',L+8,T+ph-14);
}
$('#mclose').addEventListener('click',()=>{if(dlView){dlView=null;renderFx()}});
