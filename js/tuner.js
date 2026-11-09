// pulsekid · afinador de pitch offline e medidor de afinação ao vivo
/* ---------- afinador: correção de pitch offline (Web Worker) ---------- */
function tuneWorker(){
  self.onmessage=e=>{const r=tune(e.data);self.postMessage({ch:r},r.map(a=>a.buffer))};
  function tune({ch,sr,key,scale,strength,speed}){
    const n=ch[0].length,nc=ch.length,mono=new Float32Array(n);
    for(let c=0;c<nc;c++){const d=ch[c];for(let i=0;i<n;i++)mono[i]+=d[i]/nc}
    const ds=Math.max(1,Math.round(sr/11025)),srd=sr/ds,nd=Math.floor(n/ds),xd=new Float32Array(nd);
    for(let i=0;i<nd;i++){let s=0;for(let j=0;j<ds;j++)s+=mono[i*ds+j];xd[i]=s/ds}
    const W=Math.round(srd*.035),tmin=Math.max(2,Math.floor(srd/800)),tmax=Math.min(Math.floor(srd/70),W),hop=Math.max(16,Math.round(srd*.006));
    const nf=Math.max(0,Math.floor((nd-W-tmax)/hop)+1),f0=new Float32Array(nf),d=new Float32Array(tmax+2);
    // 1) detecção de pitch (YIN)
    for(let k=0;k<nf;k++){
      const o=k*hop;let e=0;for(let j=0;j<W;j++)e+=xd[o+j]*xd[o+j];
      if(Math.sqrt(e/W)<.008)continue;
      let run=0;d[0]=1;
      for(let t=1;t<=tmax;t++){let s=0;for(let j=0;j<W;j++){const df=xd[o+j]-xd[o+j+t];s+=df*df}run+=s;d[t]=run>0?s*t/run:1}
      let tau=-1;
      for(let t=tmin;t<tmax;t++){if(d[t]<.15){while(t+1<tmax&&d[t+1]<d[t])t++;tau=t;break}}
      if(tau<0)continue;
      const a=d[tau-1],b=d[tau],c=d[tau+1],den=2*(a-2*b+c);
      f0[k]=srd/(den!==0?tau+(a-c)/den:tau);
      if(k%400===0)self.postMessage({p:k/nf*.3});
    }
    // 2) mediana em notas MIDI e flag de voz
    const m=new Float32Array(nf),ms=new Float32Array(nf),vo=new Uint8Array(nf);
    for(let k=0;k<nf;k++)m[k]=f0[k]>0?69+12*Math.log2(f0[k]/440):0;
    for(let k=0;k<nf;k++){const arr=[];for(let j=k-2;j<=k+2;j++)if(j>=0&&j<nf&&m[j]>0)arr.push(m[j]);
      if(m[k]>0&&arr.length>=3){arr.sort((x,y)=>x-y);ms[k]=arr[arr.length>>1];vo[k]=1}}
    // 3) nota alvo na escala + suavização (velocidade)
    const P={chromatic:[0,1,2,3,4,5,6,7,8,9,10,11],major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],pmaj:[0,2,4,7,9],pmin:[0,3,5,7,10]};
    const ok=new Uint8Array(12);(P[scale]||P.chromatic).forEach(p=>ok[(p+key)%12]=1);
    const near=x=>{const r=Math.round(x);let best=r,bd=1e9;for(let c=r-6;c<=r+6;c++){if(!ok[((c%12)+12)%12])continue;const dd=Math.abs(c-x);if(dd<bd){bd=dd;best=c}}return best};
    const sh=new Float32Array(nf),a=speed<=0?1:1-Math.exp(-(hop*ds/sr*1000)/speed);let cur=0,pv=false;
    for(let k=0;k<nf;k++){
      if(!vo[k]){pv=false;continue}
      const tgt=Math.max(-4,Math.min(4,(near(ms[k])-ms[k])*strength));
      if(!pv)cur=tgt;else cur+=(tgt-cur)*a;pv=true;sh[k]=cur;
    }
    // 4) PSOLA: marcas de pitch + overlap-add com janelas de 2 períodos
    const fr=t=>{const k=Math.round((t/ds-W/2)/hop);return k<0?0:k>=nf?nf-1:k};
    const marks=[],Ta=[],Rr=[];let t=0;
    while(t<n){
      const k=nf?fr(t):0;let T,r=1,v=nf&&vo[k];
      if(v){T=sr/(440*Math.pow(2,(ms[k]-69)/12));r=Math.pow(2,sh[k]/12)}else T=sr*.005;
      let p=Math.round(t);
      if(v){const w=Math.floor(T*.3);let best=-1e9,bi=p;for(let j=-w;j<=w;j++){const q=p+j;if(q<0||q>=n)continue;if(mono[q]>best){best=mono[q];bi=q}}p=bi}
      marks.push(p);Ta.push(T);Rr.push(r);t=p+T;
    }
    const out=ch.map(()=>new Float32Array(n));let ts=0,k=0,cnt=0;
    while(ts<n&&marks.length){
      while(k+1<marks.length&&Math.abs(marks[k+1]-ts)<=Math.abs(marks[k]-ts))k++;
      const T=Ta[k],r=Rr[k],L=Math.max(2,Math.round(T)),p=marks[k],g=1/r,tsr=Math.round(ts);
      for(let j=-L;j<=L;j++){const si=p+j,di=tsr+j;if(si<0||si>=n||di<0||di>=n)continue;const w=.5*(1+Math.cos(Math.PI*j/L))*g;for(let c=0;c<nc;c++)out[c][di]+=ch[c][si]*w}
      ts+=T/r;if(++cnt%2000===0)self.postMessage({p:.3+.7*ts/n});
    }
    return out;
  }
}
const NOTE_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];let tuneURL=null;
function openTune(){
  if(!selClip)return toast('selecione um clipe para afinar');
  const c=selClip;$('#mtitle').textContent='afinador';
  $('#mbody').innerHTML=`<div class="tune">
    <div class="pr"><span>tom</span><select id="tk">${NOTE_NAMES.map((n,i)=>`<option value="${i}">${n}</option>`).join('')}</select><em></em></div>
    <div class="pr"><span>escala</span><select id="ts"><option value="chromatic">cromática</option><option value="major">maior</option><option value="minor">menor</option><option value="pmaj">pentatônica maior</option><option value="pmin">pentatônica menor</option></select><em></em></div>
    <div class="pr"><span>força</span><input id="tst" type="range" min="0" max="100" value="100"><em id="tstv">100%</em></div>
    <div class="pr"><span>veloc.</span><input id="tsp" type="range" min="0" max="400" value="30"><em id="tspv">30ms</em></div>
    <div style="color:var(--mut);font-size:11px;max-width:320px">Funciona melhor com voz ou instrumento solo (uma nota por vez). Veloc. 0 = efeito "robô". Ctrl+Z desfaz.</div>
    <button id="trun">afinar clipe</button><div id="tstat" style="color:var(--mut)"></div></div>`;
  $('#tst').oninput=e=>$('#tstv').textContent=e.target.value+'%';$('#tsp').oninput=e=>$('#tspv').textContent=e.target.value+'ms';
  $('#trun').onclick=()=>runTune(c);$('#modal').style.display='flex';
}
function runTune(c){
  const b=c.buf,sr=b.sampleRate,s0=Math.floor(c.off*sr),s1=Math.min(b.length,Math.floor((c.off+c.dur)*sr));
  const chs=Array.from({length:b.numberOfChannels},(_,i)=>b.getChannelData(i).slice(s0,s1));
  tuneURL=tuneURL||URL.createObjectURL(new Blob(['('+tuneWorker.toString()+')()'],{type:'application/javascript'}));
  const w=new Worker(tuneURL),st=$('#tstat');$('#trun').disabled=true;st.textContent='processando… 0%';
  w.onmessage=e=>{
    if(e.data.p!==undefined){st.textContent='processando… '+Math.round(e.data.p*100)+'%';return}
    const out=e.data.ch,nb=ac.createBuffer(out.length,out[0].length,sr);out.forEach((d,i)=>nb.copyToChannel(d,i));w.terminate();
    $('#mclose').click();if(!ownerOf(c))return;
    pushUndo();c.buf=nb;c.off=0;c.dur=nb.duration;render();refreshPlay();toast('clipe afinado');
  };
  w.onerror=()=>{w.terminate();st.textContent='erro ao processar este clipe';$('#trun').disabled=false};
  w.postMessage({ch:chs,sr,key:+$('#tk').value,scale:$('#ts').value,strength:+$('#tst').value/100,speed:+$('#tsp').value},chs.map(a=>a.buffer));
}
$('#tune').onclick=openTune;

/* ---------- medidor de afinação ao vivo (YIN no microfone) ---------- */
function detectPitch(x,sr){
  const n=x.length;let e=0;for(let i=0;i<n;i++)e+=x[i]*x[i];if(Math.sqrt(e/n)<.01)return 0;
  const tmax=Math.min(Math.floor(sr/70),(n>>1)-1),tmin=Math.max(2,Math.floor(sr/1400)),W=n-tmax-1,d=new Float32Array(tmax+2);let run=0;d[0]=1;
  for(let t=1;t<=tmax;t++){let s=0;for(let j=0;j<W;j++){const df=x[j]-x[j+t];s+=df*df}run+=s;d[t]=run>0?s*t/run:1}
  let tau=-1;for(let t=tmin;t<tmax;t++){if(d[t]<.15){while(t+1<tmax&&d[t+1]<d[t])t++;tau=t;break}}
  if(tau<0)return 0;
  const a=d[tau-1],b=d[tau],c=d[tau+1],den=2*(a-2*b+c);return sr/(den!==0?tau+(a-c)/den:tau);
}
let tnOn=false,tnAn=null,tnSrc=null,tnT=null,tnM=0,tnHold=0;const tnBuf=new Float32Array(2048);
async function toggleTuner(){
  if(tnOn){tnOn=false;clearInterval(tnT);try{tnSrc&&tnSrc.disconnect(tnAn)}catch{}tnSrc=null;$('#tnw').style.display='none';$('#tn').classList.remove('on');return}
  try{await ac.resume();await setupMic()}catch(e){return toast('permita o microfone')}
  tnOn=true;$('#tn').classList.add('on');$('#tnw').style.display='flex';
  tnAn=tnAn||ac.createAnalyser();tnAn.fftSize=2048;tnT=setInterval(tunerTick,50);
}
function tunerTick(){
  if(tnSrc!==micSrc){try{tnSrc&&tnSrc.disconnect(tnAn)}catch{}tnSrc=micSrc;if(micSrc)micSrc.connect(tnAn)}
  tnAn.getFloatTimeDomainData(tnBuf);const f=detectPitch(tnBuf,ac.sampleRate);
  if(f>0){const m=69+12*Math.log2(f/440);tnM=tnM&&Math.abs(m-tnM)<1.5?tnM*.6+m*.4:m;tnHold=6}
  else if(tnHold>0)tnHold--;else tnM=0;
  const nn=$('#tnn'),cs=$('#tnc'),nd=$('#tnd');
  if(!tnM){nn.textContent='–';cs.textContent='';nd.style.opacity=.2;return}
  const r=Math.round(tnM),cents=Math.round((tnM-r)*100);
  nn.textContent=NOTE_NAMES[((r%12)+12)%12]+(Math.floor(r/12)-1);cs.textContent=(cents>0?'+':'')+cents+'¢';
  nd.style.opacity=1;nd.style.left=(50+cents)+'%';nd.style.background=Math.abs(cents)<=10?'#3ddc97':'var(--amb)';
}
$('#tn').onclick=toggleTuner;
