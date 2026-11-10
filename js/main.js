// pulsekid · zoom, avisos, atalhos de teclado e inicialização
/* ---------- misc ---------- */
$('#zi').onclick=()=>{pps=Math.min(240,pps*1.5);render()};$('#zo').onclick=()=>{pps=Math.max(15,pps/1.5);render()};
const applyTh=()=>document.documentElement.style.setProperty('--th',th+'px');
$('#hvi').onclick=()=>{th=Math.min(300,Math.round(th*1.3));applyTh();render()};
$('#hvo').onclick=()=>{th=Math.max(88,Math.round(th/1.3));applyTh();render()};
/* celular: gaveta de plugins e zoom com dois dedos */
$('#fxb').onclick=()=>document.body.classList.toggle('fxopen');
(()=>{const sc=$('#scroll');let d0=0,p0=60,last=0;const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
  sc.addEventListener('touchstart',e=>{if(e.touches.length===2){d0=dist(e.touches);p0=pps;last=pps}},{passive:true});
  sc.addEventListener('touchmove',e=>{if(e.touches.length!==2||!d0)return;e.preventDefault();
    const np=Math.max(15,Math.min(240,p0*dist(e.touches)/d0));if(Math.abs(np/last-1)<.06)return;
    const cx=(e.touches[0].clientX+e.touches[1].clientX)/2-sc.getBoundingClientRect().left,t=(sc.scrollLeft+cx-HW)/pps;
    last=pps=np;render();sc.scrollLeft=Math.max(0,t*pps+HW-cx)},{passive:false});
  sc.addEventListener('touchend',e=>{if(e.touches.length<2)d0=0})})();
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('s');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('s'),2200)}
document.addEventListener('click',e=>{if(e.target.tagName==='BUTTON')e.target.blur()});
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
  if(mod&&k==='s'){e.preventDefault();saveProject(true).then(()=>toast('projeto salvo'));return}
  if(['INPUT','SELECT'].includes(e.target.tagName)&&e.target.type!=='range')return;
  if(mod&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
  if(mod&&k==='y'){e.preventDefault();redo();return}
  if(mod&&k==='d'){e.preventDefault();doDup();return}
  if(mod)return;
  if(e.code==='Space'){e.preventDefault();$('#pp').click()}
  else if(k==='r')$('#rc').click();
  else if(k==='m')$('#metro').click();
  else if(k==='l')$('#loop').click();
  else if(k==='s')doSplit();
  else if(k==='delete'||k==='backspace'){e.preventDefault();doDel()}
  else if(e.code==='Home')seek(0);
});
(async()=>{
  await ensureWorklets(ac);
  const ok=await loadProject();
  if(!ok){while(tracks.length){const t=tracks.pop();try{t.panN.disconnect();t.in.disconnect()}catch{}}const t=mkTrack();t.arm=true;selected=t}
  render();ui();
  [...tracks,M].forEach(o=>o.fx.forEach(f=>{if(f.type==='wam'&&!f._wam){f._owner=o;loadWam(f).catch(()=>toast('falha ao carregar o plugin '+(f.p.name||'')))}}));
})();
