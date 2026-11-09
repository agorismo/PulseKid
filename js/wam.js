// pulsekid · plugins de terceiros (Web Audio Modules)
/* ---------- plugins de terceiros (WAM) ---------- */
let wamHost=null,wamFilled=false,curGui=null;
const SDKS=['https://esm.sh/@webaudiomodules/sdk','https://cdn.jsdelivr.net/npm/@webaudiomodules/sdk/+esm'];
const wamNode=f=>f._wam&&(f._wam.audioNode||(f._wam.getAudioNode&&f._wam.getAudioNode()));
async function getHost(){
  if(wamHost!==null)return wamHost;let mod=null;
  for(const u of SDKS){try{mod=await import(u);break}catch(e){}}
  if(!mod)throw new Error('sdk');
  const init=mod.initializeWamHost||(mod.default&&mod.default.initializeWamHost)||(typeof mod.default==='function'?mod.default:null);
  if(!init)throw new Error('sdk');
  const r=await init(ac);wamHost=Array.isArray(r)?r[0]:r;return wamHost;
}
async function loadWam(f){
  const host=await getHost().catch(()=>null);
  const mod=await import(f.p.url),F=mod.default||mod;let inst;
  try{inst=host!==null?await F.createInstance(host,ac,{}):await F.createInstance(ac,{})}catch(e){inst=await F.createInstance(ac,{})}
  f._wam=inst;if(f.state&&inst.setState){try{await inst.setState(f.state)}catch{}}
  const d=F.descriptor||inst.descriptor||{};
  f.p.name=d.name||(f.p.name&&f.p.name!=='carregando…'?f.p.name:(f.p.url.split('/').slice(-2)[0]||'plugin'));
  if(f._owner)rebuild(f._owner);renderFx();
}
async function openGui(f){
  try{const el=await f._wam.createGui();curGui={f,el};$('#mtitle').textContent=f.p.name;const b=$('#mbody');b.innerHTML='';b.appendChild(el);$('#modal').style.display='flex'}
  catch(e){toast('este plugin não tem interface')}
}
$('#mclose').onclick=()=>{try{curGui&&curGui.f._wam.destroyGui&&curGui.f._wam.destroyGui(curGui.el)}catch{}curGui=null;$('#modal').style.display='none';$('#mbody').innerHTML=''};
async function fillWam(){
  if(wamFilled)return;wamFilled=true;const sel=$('#wamsel');
  try{const j=await (await fetch('https://www.webaudiomodules.com/community/plugins.json')).json();
    const arr=Array.isArray(j)?j:(j.plugins||Object.values(j));
    arr.forEach(e=>{const path=e&&(e.path||e.url||e.src);if(!path)return;
      let u=/^https?:/.test(path)?path:'https://www.webaudiomodules.com/community/plugins/'+String(path).replace(/^\/+/,'');
      if(!/\.js$/.test(u))u=u.replace(/\/$/,'')+'/index.js';
      sel.add(new Option((e.name||e.label||path)+(e.vendor?' · '+e.vendor:''),u))});
  }catch(e){toast('catálogo indisponível — cole a URL do plugin')}
}
$('#wamsel').onfocus=fillWam;
$('#wamadd').onclick=()=>{
  const url=$('#wamurl').value.trim()||$('#wamsel').value;if(!url)return toast('escolha ou cole a URL de um plugin WAM');
  const o=selected||M,f={type:'wam',p:{url,name:'carregando…'},bypass:false,_owner:o};o.fx.push(f);rebuild(o);renderFx();
  loadWam(f).catch(e=>{toast('não consegui carregar esse plugin');const i=o.fx.indexOf(f);if(i>=0)o.fx.splice(i,1);rebuild(o);renderFx()});
  $('#wamurl').value='';
};
$('#pladd').onclick=()=>{const o=selected||M,k=$('#plsel').value,p={};PL[k].params.forEach(q=>p[q.k]=q.v);o.fx.push({type:k,p,bypass:false});rebuild(o);renderFx()};
