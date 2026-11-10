// pulsekid · edição de clipes: cortar, mover, aparar, fades, duplicar, desfazer/refazer
/* ---------- edição de clipes ---------- */
let undoS=[],redoS=[];
const snapState=()=>tracks.map(t=>[t,t.takes.map(a=>a.map(c=>({...c}))),t.ti]);
function restore(s){s.forEach(([t,tk,ti])=>{if(tracks.includes(t)){t.takes=tk.map(a=>a.map(c=>({...c})));t.ti=ti}})}
function pushUndo(){undoS.push(snapState());if(undoS.length>60)undoS.shift();redoS=[]}
function undo(){if(!undoS.length)return;redoS.push(snapState());restore(undoS.pop());selClip=null;render();refreshPlay()}
function redo(){if(!redoS.length)return;undoS.push(snapState());restore(redoS.pop());selClip=null;render();refreshPlay()}
const refreshPlay=()=>{if(playing&&!recording)seek(pos())};
const ownerOf=c=>tracks.find(t=>t.clips.includes(c));
function doSplit(){
  const p=pos();let cands=[];
  if(selClip&&p>selClip.start+.01&&p<selClip.start+selClip.dur-.01)cands=[selClip];
  else(selected&&!selected.master?[selected]:tracks).forEach(t=>t.clips.forEach(c=>{if(p>c.start+.01&&p<c.start+c.dur-.01)cands.push(c)}));
  if(!cands.length)return toast('posicione o cursor sobre um clipe');
  pushUndo();
  cands.forEach(c=>{const t=ownerOf(c),e=c.start+c.dur,r={...c,id:++cid,start:p,off:c.off+(p-c.start),dur:e-p,fi:0};c.dur=p-c.start;c.fi=Math.min(c.fi||0,c.dur);c.fo=0;r.fo=Math.min(r.fo||0,r.dur);t.clips.splice(t.clips.indexOf(c)+1,0,r)});
  render();refreshPlay();
}
function doDup(){
  if(!selClip)return toast('selecione um clipe');
  const t=ownerOf(selClip);if(!t)return;pushUndo();
  const n={...selClip,id:++cid,start:selClip.start+selClip.dur};t.clips.push(n);selClip=n;render();refreshPlay();
}
function doDel(){
  if(!selClip)return toast('selecione um clipe');
  const t=ownerOf(selClip);if(!t)return;pushUndo();t.clips.splice(t.clips.indexOf(selClip),1);selClip=null;render();refreshPlay();
}
$('#undo').onclick=undo;$('#redo').onclick=redo;$('#split').onclick=doSplit;$('#dup').onclick=doDup;$('#del').onclick=doDel;
function trackAtY(y){for(const r of document.querySelectorAll('.row[data-id]')){if(r.dataset.id==='m')continue;const b=r.getBoundingClientRect();if(y>=b.top&&y<b.bottom)return tracks.find(t=>String(t.id)===r.dataset.id)}return null}
function clipDown(e,t,c,el){
  e.stopPropagation();e.preventDefault();if(recording)return;
  selClip=c;document.querySelectorAll('.clip.sel').forEach(x=>x.classList.remove('sel'));el.classList.add('sel');if(selected!==t)select(t);
  const mode=e.target.dataset.h||'move',sx=e.clientX,o={start:c.start,off:c.off,dur:c.dur,fi:c.fi||0,fo:c.fo||0},nv={...o,track:t};let moved=false;
  const mv=ev=>{
    if(!moved&&Math.abs(ev.clientX-sx)<4)return;moved=true;const dx=(ev.clientX-sx)/pps;
    if(mode==='move'){nv.start=Math.max(0,snap(o.start+dx));el.style.left=nv.start*pps+'px';
      document.querySelectorAll('.row.drop').forEach(r=>r.classList.remove('drop'));
      const tr=trackAtY(ev.clientY);if(tr){nv.track=tr;$('.row[data-id="'+tr.id+'"]').classList.add('drop')}}
    else if(mode==='l'){let d=snap(o.start+dx)-o.start;d=Math.min(Math.max(d,-o.off,-o.start),o.dur-.05);nv.start=o.start+d;nv.off=o.off+d;nv.dur=o.dur-d;el.style.left=nv.start*pps+'px';el.style.width=nv.dur*pps+'px'}
    else if(mode==='r'){const ne=snap(o.start+o.dur+dx);nv.dur=Math.min(c.buf.duration-o.off,Math.max(.05,ne-o.start));el.style.width=nv.dur*pps+'px'}
    else if(mode==='fi'){nv.fi=Math.max(0,Math.min(o.dur-o.fo,o.fi+dx));fadeUI(el,nv.fi,nv.fo)}
    else if(mode==='fo'){nv.fo=Math.max(0,Math.min(o.dur-o.fi,o.fo-dx));fadeUI(el,nv.fi,nv.fo)}
  };
  const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);
    if(!moved)return;pushUndo();c.start=nv.start;c.off=nv.off;c.dur=nv.dur;c.fi=Math.min(nv.fi,nv.dur);c.fo=Math.min(nv.fo,nv.dur-c.fi);
    if(nv.track!==t){t.clips.splice(t.clips.indexOf(c),1);nv.track.clips.push(c)}
    render();refreshPlay()};
  addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',up);
}
