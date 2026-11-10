// pulsekid · estado global, AudioContext e variáveis compartilhadas
const $=(s,e=document)=>e.querySelector(s);
const ac=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});
let th=88,pps=60,D=30,uid=0,cid=0,selected=null,selClip=null,playing=false,t0=0,pos0=0,srcs=[],recording=false,rec=null;
let micStream,micSrc,micAn,worklet,chunks=[];
let loopOn=false,loopA=0,loopB=0,metro=false,nextBeat=0,lapPending=false,counting=false,countOsc=[];
const tracks=[];
const M={name:'master',vol:.9,fx:[],master:true};
/* largura do cabeçalho das trilhas: menor no celular */
let HW=220;
const mqMobile=matchMedia('(max-width:900px),(max-height:520px)');
const setHW=()=>{HW=mqMobile.matches?150:220;document.documentElement.style.setProperty('--hw',HW+'px')};
setHW();mqMobile.addEventListener('change',()=>{setHW();if(typeof render==='function'&&tracks.length)render()});
