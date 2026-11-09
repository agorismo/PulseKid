// pulsekid · renderização das trilhas, forma de onda e painel de plugins
/* ---------- UI ---------- */
function render(){
  let need=Math.max(0,...tracks.flatMap(t=>t.clips.map(c=>c.start+c.dur)),loopB)+10;while(D<need)D+=30;
  const box=$('#tracks');box.innerHTML='';
  const ru=document.createElement('div');ru.className='row ruler';ru.innerHTML=`<div class="head"></div><div class="lane" style="width:${D*pps}px"></div>`;
  const rl=$('.lane',ru),step=pps<40?10:5;
  for(let s=0;s<D;s+=step){const k=document.createElement('div');k.className='tick';k.style.left=s*pps+'px';k.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');rl.appendChild(k)}
  rl.onpointerdown=e=>{
    if(recording)return;const r=rl.getBoundingClientRect(),x0=e.clientX,px=x=>Math.max(0,(x-r.left)/pps);let drag=false;
    const mv=ev=>{if(!drag&&Math.abs(ev.clientX-x0)<5)return;drag=true;let a=snap(px(x0)),b=snap(px(ev.clientX));if(a>b)[a,b]=[b,a];loopA=a;loopB=b;loopOn=b-a>.05;drawLoop();ui()};
    const up=ev=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);if(drag){if(playing)seek(pos())}else seek(px(ev.clientX))};
    addEventListener('pointermove',mv);addEventListener('pointerup',up);
  };
  box.appendChild(ru);
  const bp=spb()*pps,barp=bp*4;
  [...tracks,M].forEach(t=>{
    const r=document.createElement('div');r.className='row'+(t===selected?' sel':'');r.dataset.id=t.master?'m':t.id;
    if(t.master){r.innerHTML=`<div class="head"><div class="r1"><b style="flex:1">master</b></div><div class="r3"><span>vol</span><input type="range" min="0" max="1.2" step=".01" value="${t.vol}" data-a="vol"></div></div><div class="lane" style="width:${D*pps}px;height:60px"></div>`}
    else r.innerHTML=`<div class="head">
      <div class="r1"><input class="nm" value="${t.name.replace(/"/g,'&quot;')}">${t.takes.length>1?`<button data-a="tk" title="trocar de take · shift+clique apaga o take atual">t${t.ti+1}/${t.takes.length}</button>`:''}<button data-a="del">×</button></div>
      <div class="r2"><button class="arm ${t.arm?'on':''}" data-a="arm">R</button><button class="${t.mon?'on':''}" data-a="mon" title="monitorar entrada (use fones)">in</button><button class="${t.mute?'on':''}" data-a="mute">M</button><button class="${t.solo?'on':''}" data-a="solo">S</button></div>
      <div class="r3"><span>vol</span><input type="range" min="0" max="1.2" step=".01" value="${t.vol}" data-a="vol"><span>pan</span><input type="range" min="-1" max="1" step=".01" value="${t.pan}" data-a="pan"></div></div>
      <div class="lane" id="lane${t.id}" style="width:${D*pps}px"></div>`;
    const lane=$('.lane',r);
    lane.style.backgroundImage=`repeating-linear-gradient(90deg,#1f1f26 0 1px,transparent 1px ${barp}px),repeating-linear-gradient(90deg,#141418 0 1px,transparent 1px ${bp}px)`;
    lane.onclick=e=>{if(e.target===lane){selClip=null;document.querySelectorAll('.clip.sel').forEach(x=>x.classList.remove('sel'));seek((e.clientX-lane.getBoundingClientRect().left)/pps)}};
    if(!t.master)t.clips.forEach(c=>{
      const el=document.createElement('div');el.className='clip'+(c===selClip?' sel':'');el.style.left=c.start*pps+'px';el.style.width=Math.max(3,c.dur*pps)+'px';
      el.innerHTML='<canvas></canvas><i class="fz fi"></i><i class="fz fo"></i><i class="h l" data-h="l"></i><i class="h r" data-h="r"></i><i class="fh fi" data-h="fi" title="fade in"></i><i class="fh fo" data-h="fo" title="fade out"></i>';
      drawWave($('canvas',el),c);fadeUI(el,c.fi||0,c.fo||0);
      el.onpointerdown=e=>clipDown(e,t,c,el);lane.appendChild(el)});
    r.onclick=e=>{if(e.target.closest('.head')&&selected!==t)select(t)};
    r.querySelectorAll('[data-a]').forEach(el=>{const a=el.dataset.a;
      el[el.type==='range'?'oninput':'onclick']=e=>{
        if(a==='vol'){t.vol=+el.value;if(t.master)M.outN.gain.value=t.vol;else mix()}
        if(a==='pan'){t.pan=+el.value;mix()}
        if(a==='mute'){t.mute=!t.mute;el.classList.toggle('on');mix()}
        if(a==='solo'){t.solo=!t.solo;el.classList.toggle('on');mix()}
        if(a==='mon'){t.mon=!t.mon;el.classList.toggle('on');updateMon()}
        if(a==='arm'){const v=!t.arm;tracks.forEach(x=>x.arm=false);t.arm=v;render();if(v)setupMic().then(updateMon).catch(()=>toast('permita o microfone'))}
        if(a==='tk'){if(e.shiftKey){if(!confirm('Apagar este take?'))return;pushUndo();t.takes.splice(t.ti,1);t.ti=Math.max(0,t.ti-1)}else{pushUndo();t.ti=(t.ti+1)%t.takes.length}
          selClip=null;render();refreshPlay();return}
        if(a==='del'){if(playing)pause();try{t.panN.disconnect();t.in.disconnect()}catch{}tracks.splice(tracks.indexOf(t),1);if(selected===t)selected=M;if(selClip&&!ownerOf(selClip))selClip=null;render();renderFx()}
      }});
    const nm=$('.nm',r);if(nm)nm.oninput=()=>t.name=nm.value;
    box.appendChild(r);
  });
  drawLoop();renderFx();
}
function fadeUI(el,fi,fo){
  $('.fz.fi',el).style.width=fi*pps+'px';$('.fz.fo',el).style.width=fo*pps+'px';
  $('.fh.fi',el).style.left=fi*pps+'px';$('.fh.fo',el).style.right=fo*pps+'px';
}
function drawLoop(){
  document.querySelectorAll('.lp').forEach(e=>e.remove());if(loopB<=loopA+.01)return;
  const cls=loopOn?' act':'',sh=document.createElement('div');sh.className='lp shade'+cls;sh.style.left=(220+loopA*pps)+'px';sh.style.width=(loopB-loopA)*pps+'px';$('#inner').appendChild(sh);
  const rb=document.createElement('div');rb.className='lp rb'+cls;rb.style.left=loopA*pps+'px';rb.style.width=(loopB-loopA)*pps+'px';const rl=$('.ruler .lane');if(rl)rl.appendChild(rb);
}
function drawWave(cv,c){
  const b=c.buf,sr=b.sampleRate,w=cv.width=Math.max(1,Math.min(8192,Math.ceil(c.dur*pps))),h=cv.height=Math.max(20,th-22),x=cv.getContext('2d'),d=b.getChannelData(0),s0=Math.floor(c.off*sr),n=Math.floor(c.dur*sr),sp=n/w,st=Math.max(1,Math.floor(sp/40));
  x.strokeStyle='#ff8fa3';x.beginPath();
  for(let i=0;i<w;i++){let mn=0,mx=0;for(let j=s0+Math.floor(i*sp),e=Math.min(d.length,s0+Math.floor((i+1)*sp));j<e;j+=st){const v=d[j];if(v<mn)mn=v;if(v>mx)mx=v}
    x.moveTo(i+.5,h/2+mn*h/2-.5);x.lineTo(i+.5,h/2+mx*h/2+.5)}
  x.stroke();
}
function select(o){selected=o;document.querySelectorAll('.row[data-id]').forEach(r=>r.classList.toggle('sel',r.dataset.id===(o.master?'m':String(o.id))));renderFx()}
function renderFx(){
  const o=selected||M;$('#insT').textContent='plugins · '+(o.master?'master':o.name);
  const box=$('#fxs');box.innerHTML='';
  o.fx.forEach((f,idx)=>{
    const p=PL[f.type],d=document.createElement('div');d.className='fx'+(f.bypass?' off':'');
    const isW=f.type==='wam';
    d.innerHTML=`<div class="t"><b>${isW?(f.p.name||'WAM').replace(/</g,'&lt;'):p.name}</b>${isW&&f._wam?'<button data-b="gui">gui</button>':''}${p.custom?'<button data-b="edit">editar</button>':''}<button data-b="up">↑</button><button data-b="by" class="${f.bypass?'':'on'}">on</button><button data-b="rm">×</button></div>`+
      p.params.map(q=>`<div class="pr"><span>${q.l}</span><input type="range" min="${q.min}" max="${q.max}" step="${q.s}" value="${f.p[q.k]}" data-k="${q.k}"><em>${fmtv(q,f.p[q.k])}</em></div>`).join('');
    d.querySelectorAll('input').forEach(i=>i.oninput=()=>{const q=p.params.find(x=>x.k===i.dataset.k);f.p[q.k]=+i.value;f.inst&&f.inst.set(q.k,+i.value);i.nextElementSibling.textContent=fmtv(q,+i.value)});
    const gb=d.querySelector('[data-b=gui]');if(gb)gb.onclick=()=>openGui(f);
    if(p.custom){
      const cv=document.createElement('canvas');cv.width=520;cv.height=100;cv.title='clique para editar';
      cv.style.cssText='width:100%;height:50px;cursor:pointer;border-radius:6px;background:#0f0f12';cv.onclick=()=>openEq(f,o);
      d.appendChild(cv);peqMini(cv,f.p.b,f.bypass);d.querySelector('[data-b=edit]').onclick=()=>openEq(f,o);
    }
    d.querySelector('[data-b=by]').onclick=()=>{f.bypass=!f.bypass;rebuild(o);renderFx()};
    d.querySelector('[data-b=rm]').onclick=()=>{o.fx.splice(idx,1);rebuild(o);renderFx()};
    d.querySelector('[data-b=up]').onclick=()=>{if(idx>0){[o.fx[idx-1],o.fx[idx]]=[o.fx[idx],o.fx[idx-1]];rebuild(o);renderFx()}};
    box.appendChild(d);
  });
  if(!o.fx.length)box.innerHTML='<div style="color:var(--mut)">nenhum plugin. adicione abaixo.</div>';
}
$('#plsel').innerHTML=Object.entries(PL).filter(([k,v])=>!v.hidden).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('');
