// pulsekid · rack de plugins: EQ, compressor, reverb, delay, drive, chorus, filtro, phaser, flanger, tremolo, bitcrush, limiter, noise gate
/* ---------- plugins (rack) ---------- */
const db=v=>Math.pow(10,v/20);
function makeIR(c,sec){const n=Math.floor(c.sampleRate*sec),b=c.createBuffer(2,n,c.sampleRate);
  for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2.5)}return b}
const P=(k,l,min,max,v,s,u='',o=null)=>({k,l,min,max,v,s,u,o});
const fmtv=(q,v)=>q.o?q.o[Math.round(v)]:(+v).toFixed(q.s<1?2:0)+q.u;
const PL={
 eq:{name:'EQ simples',params:[P('low','graves',-15,15,0,.5,'dB'),P('mid','médios',-15,15,0,.5,'dB'),P('high','agudos',-15,15,0,.5,'dB')],
  make(c){const lo=c.createBiquadFilter(),mi=c.createBiquadFilter(),hi=c.createBiquadFilter();
   lo.type='lowshelf';lo.frequency.value=200;mi.type='peaking';mi.frequency.value=1200;mi.Q.value=.9;hi.type='highshelf';hi.frequency.value=5000;
   lo.connect(mi);mi.connect(hi);const m={low:lo,mid:mi,high:hi};
   return{in:lo,out:hi,set:(k,v)=>m[k].gain.value=v}}},
 comp:{name:'compressor',editor:(f,o)=>openComp(f,o),
  params:[P('threshold','limiar',-60,0,-20,1,'dB'),P('ratio','razão',1,20,4,.5,':1'),P('attack','ataque',1,100,10,1,'ms'),P('release','release',20,1000,200,10,'ms'),P('knee','joelho',0,40,6,1,'dB'),P('makeup','ganho',0,24,3,.5,'dB')],
  make(c){
   let n;try{n=new AudioWorkletNode(c,'pk-comp')}catch(e){const g=c.createGain();return{in:g,out:g,set(){},gr:0}}
   const i=c.createGain();i.connect(n);let an=null;if(c===ac){an=c.createAnalyser();an.fftSize=1024;i.connect(an)}
   const inst={in:i,out:n,an,gr:0,set:(k,v)=>{const q=n.parameters.get(k);if(q)q.value=v}};
   n.port.onmessage=e=>{inst.gr=e.data};return inst}},
 reverb:{name:'reverb',params:[P('size','tamanho',.3,5,1.8,.1,'s'),P('mix','mix',0,1,.25,.01)],
  make(c){const i=c.createGain(),o=c.createGain(),d=c.createGain(),w=c.createGain(),cv=c.createConvolver();
   i.connect(d);d.connect(o);i.connect(cv);cv.connect(w);w.connect(o);
   return{in:i,out:o,set:(k,v)=>{if(k==='size')cv.buffer=makeIR(c,v);if(k==='mix'){d.gain.value=Math.cos(v*Math.PI/2);w.gain.value=Math.sin(v*Math.PI/2)*1.3}}}}},
 delay:{name:'delay',params:[P('time','tempo',.02,1,.3,.01,'s'),P('fb','feedback',0,.9,.35,.01),P('mix','mix',0,1,.3,.01)],
  make(c){const i=c.createGain(),o=c.createGain(),d=c.createGain(),w=c.createGain(),dl=c.createDelay(2),fb=c.createGain();
   i.connect(d);d.connect(o);i.connect(dl);dl.connect(w);w.connect(o);dl.connect(fb);fb.connect(dl);
   return{in:i,out:o,set:(k,v)=>{if(k==='time')dl.delayTime.value=v;if(k==='fb')fb.gain.value=v;if(k==='mix'){d.gain.value=1-v*.5;w.gain.value=v}}}}},
 drive:{name:'drive',params:[P('amount','drive',0,100,20,1),P('tone','tom',800,16000,8000,100,'hz'),P('level','nível',-18,6,-3,.5,'dB')],
  make(c){const ws=c.createWaveShaper(),lp=c.createBiquadFilter(),g=c.createGain();ws.oversample='4x';lp.type='lowpass';ws.connect(lp);lp.connect(g);
   return{in:ws,out:g,set:(k,v)=>{if(k==='amount'){const n=2048,cu=new Float32Array(n);for(let i=0;i<n;i++){const x=i*2/n-1;cu[i]=(1+v)*x/(1+v*Math.abs(x))}ws.curve=cu}
    if(k==='tone')lp.frequency.value=v;if(k==='level')g.gain.value=db(v)}}}},
 chorus:{name:'chorus',params:[P('rate','taxa',.1,8,1.2,.1,'hz'),P('depth','prof.',0,1,.5,.01),P('mix','mix',0,1,.5,.01)],
  make(c){const i=c.createGain(),o=c.createGain(),d=c.createGain(),w=c.createGain(),dl=c.createDelay(.1),l=c.createOscillator(),lg=c.createGain();
   dl.delayTime.value=.02;i.connect(d);d.connect(o);i.connect(dl);dl.connect(w);w.connect(o);l.connect(lg);lg.connect(dl.delayTime);l.start();
   return{in:i,out:o,stop:()=>{try{l.stop()}catch{}},set:(k,v)=>{if(k==='rate')l.frequency.value=v;if(k==='depth')lg.gain.value=v*.008;if(k==='mix'){d.gain.value=1-v*.5;w.gain.value=v}}}}}
};
/* worklet do noise gate: roda na thread de áudio, também funciona no export offline */
function gateWk(){
  class Gate extends AudioWorkletProcessor{
    static get parameterDescriptors(){return[
      {name:'thr',defaultValue:-45,minValue:-90,maxValue:0,automationRate:'k-rate'},
      {name:'att',defaultValue:3,minValue:.1,maxValue:100,automationRate:'k-rate'},
      {name:'hold',defaultValue:80,minValue:0,maxValue:1000,automationRate:'k-rate'},
      {name:'rel',defaultValue:150,minValue:5,maxValue:2000,automationRate:'k-rate'},
      {name:'red',defaultValue:60,minValue:0,maxValue:90,automationRate:'k-rate'}]}
    constructor(){super();this.env=0;this.g=0;this.hc=0}
    process(ins,outs,p){
      const i=ins[0],o=outs[0];if(!i||!i.length)return true;
      const thr=Math.pow(10,p.thr[0]/20),att=Math.exp(-1/(sampleRate*p.att[0]/1000)),rel=Math.exp(-1/(sampleRate*p.rel[0]/1000));
      const hold=sampleRate*p.hold[0]/1000,floor=Math.pow(10,-p.red[0]/20),n=i[0].length;
      for(let s=0;s<n;s++){
        let pk=0;for(let c=0;c<i.length;c++){const a=Math.abs(i[c][s]);if(a>pk)pk=a}
        this.env=Math.max(pk,this.env*.9992);
        let tg;if(this.env>thr){this.hc=hold;tg=1}else if(this.hc>0){this.hc--;tg=1}else tg=floor;
        this.g=tg+(this.g-tg)*(tg>this.g?att:rel);
        for(let c=0;c<o.length;c++)o[c][s]=(i[c]||i[0])[s]*this.g}
      return true}}
  registerProcessor('pk-gate',Gate);
}
/* compressor feed-forward com joelho suave; detector de pico ligado em estéreo; informa a redução de ganho (dB) */
function compWk(){
  class Comp extends AudioWorkletProcessor{
    static get parameterDescriptors(){return[
      {name:'threshold',defaultValue:-20,minValue:-80,maxValue:0,automationRate:'k-rate'},
      {name:'ratio',defaultValue:4,minValue:1,maxValue:40,automationRate:'k-rate'},
      {name:'attack',defaultValue:10,minValue:.1,maxValue:500,automationRate:'k-rate'},
      {name:'release',defaultValue:200,minValue:5,maxValue:3000,automationRate:'k-rate'},
      {name:'knee',defaultValue:6,minValue:0,maxValue:60,automationRate:'k-rate'},
      {name:'makeup',defaultValue:0,minValue:0,maxValue:36,automationRate:'k-rate'}]}
    constructor(){super();this.gs=0;this.n=0;this.mn=0}
    process(ins,outs,p){
      const i=ins[0],o=outs[0];if(!i||!i.length)return true;
      const T=p.threshold[0],R=p.ratio[0],W=p.knee[0],mk=p.makeup[0],len=i[0].length;
      const ca=Math.exp(-1/(sampleRate*Math.max(p.attack[0],.1)/1000)),cr=Math.exp(-1/(sampleRate*Math.max(p.release[0],1)/1000));
      for(let s=0;s<len;s++){
        let pk=0;for(let c=0;c<i.length;c++){const a=Math.abs(i[c][s]);if(a>pk)pk=a}
        const x=20*Math.log10(pk>1e-6?pk:1e-6);let y;
        if(2*(x-T)<-W)y=x;else if(W>0&&2*Math.abs(x-T)<=W){const d=x-T+W/2;y=x+(1/R-1)*d*d/(2*W)}else y=T+(x-T)/R;
        const gc=y-x;this.gs=gc<this.gs?ca*this.gs+(1-ca)*gc:cr*this.gs+(1-cr)*gc;
        if(this.gs<this.mn)this.mn=this.gs;
        const g=Math.pow(10,(this.gs+mk)/20);
        for(let c=0;c<o.length;c++)o[c][s]=(i[c]||i[0])[s]*g}
      this.n+=len;if(this.n>=2048){this.port.postMessage(this.mn);this.n=0;this.mn=this.gs}
      return true}}
  registerProcessor('pk-comp',Comp);
}
const wkURL=URL.createObjectURL(new Blob(['('+gateWk.toString()+')();('+compWk.toString()+')();'],{type:'application/javascript'}));
async function ensureWorklets(c){try{await c.audioWorklet.addModule(wkURL);return true}catch(e){return false}}
Object.assign(PL,{
 gate:{name:'noise gate',params:[P('thr','limiar',-90,0,-45,1,'dB'),P('att','ataque',.1,50,3,.1,'ms'),P('hold','hold',0,500,80,5,'ms'),P('rel','release',10,1000,150,5,'ms'),P('red','redução',0,90,60,1,'dB')],
  make(c){let n;try{n=new AudioWorkletNode(c,'pk-gate')}catch(e){const g=c.createGain();return{in:g,out:g,set(){}}}
   return{in:n,out:n,set:(k,v)=>{const q=n.parameters.get(k);if(q)q.value=v}}}},
 filter:{name:'filtro',params:[P('type','tipo',0,2,0,1,'',['passa-baixa','passa-alta','passa-banda']),P('freq','freq',40,16000,2000,10,'hz'),P('res','res',.1,20,1,.1)],
  make(c){const f=c.createBiquadFilter(),T=['lowpass','highpass','bandpass'];
   return{in:f,out:f,set:(k,v)=>{if(k==='type')f.type=T[Math.round(v)];if(k==='freq')f.frequency.value=v;if(k==='res')f.Q.value=v}}}},
 phaser:{name:'phaser',params:[P('rate','taxa',.05,5,.4,.05,'hz'),P('depth','prof.',0,1,.6,.01),P('mix','mix',0,1,.5,.01)],
  make(c){const i=c.createGain(),o=c.createGain(),d=c.createGain(),w=c.createGain(),l=c.createOscillator(),lg=c.createGain();
   i.connect(d);d.connect(o);let prev=i;
   for(let n=0;n<4;n++){const a=c.createBiquadFilter();a.type='allpass';a.frequency.value=1200;a.Q.value=.7;prev.connect(a);lg.connect(a.frequency);prev=a}
   prev.connect(w);w.connect(o);l.connect(lg);l.start();
   return{in:i,out:o,stop:()=>{try{l.stop()}catch{}},set:(k,v)=>{if(k==='rate')l.frequency.value=v;if(k==='depth')lg.gain.value=v*900;if(k==='mix'){d.gain.value=1-v*.5;w.gain.value=v}}}}},
 flanger:{name:'flanger',params:[P('rate','taxa',.05,5,.25,.05,'hz'),P('depth','prof.',0,1,.7,.01),P('fb','feedback',0,.9,.5,.01),P('mix','mix',0,1,.5,.01)],
  make(c){const i=c.createGain(),o=c.createGain(),d=c.createGain(),w=c.createGain(),dl=c.createDelay(.05),fb=c.createGain(),l=c.createOscillator(),lg=c.createGain();
   dl.delayTime.value=.004;i.connect(d);d.connect(o);i.connect(dl);dl.connect(w);w.connect(o);dl.connect(fb);fb.connect(dl);l.connect(lg);lg.connect(dl.delayTime);l.start();
   return{in:i,out:o,stop:()=>{try{l.stop()}catch{}},set:(k,v)=>{if(k==='rate')l.frequency.value=v;if(k==='depth')lg.gain.value=v*.003;if(k==='fb')fb.gain.value=v;if(k==='mix'){d.gain.value=1-v*.5;w.gain.value=v}}}}},
 tremolo:{name:'tremolo',params:[P('rate','taxa',.5,15,5,.1,'hz'),P('depth','prof.',0,1,.5,.01)],
  make(c){const g=c.createGain(),l=c.createOscillator(),lg=c.createGain();l.connect(lg);lg.connect(g.gain);l.start();
   return{in:g,out:g,stop:()=>{try{l.stop()}catch{}},set:(k,v)=>{if(k==='rate')l.frequency.value=v;if(k==='depth'){lg.gain.value=v/2;g.gain.value=1-v/2}}}}},
 bitcrush:{name:'bitcrush',params:[P('bits','bits',2,16,8,1),P('mix','mix',0,1,1,.01)],
  make(c){const i=c.createGain(),o=c.createGain(),d=c.createGain(),w=c.createGain(),ws=c.createWaveShaper();i.connect(d);d.connect(o);i.connect(ws);ws.connect(w);w.connect(o);
   return{in:i,out:o,set:(k,v)=>{if(k==='bits'){const n=65536,h=Math.pow(2,v-1),cu=new Float32Array(n);for(let j=0;j<n;j++){const x=j*2/(n-1)-1;cu[j]=Math.round(x*h)/h}ws.curve=cu}if(k==='mix'){d.gain.value=1-v;w.gain.value=v}}}}},
 limiter:{name:'limiter',params:[P('gain','entrada',0,18,0,.5,'dB'),P('ceil','teto',-30,0,-3,.5,'dB'),P('release','release',20,500,100,10,'ms')],
  make(c){const g=c.createGain(),k=c.createDynamicsCompressor();k.knee.value=0;k.ratio.value=20;k.attack.value=.001;g.connect(k);
   return{in:g,out:k,set:(p,v)=>{if(p==='gain')g.gain.value=db(v);if(p==='ceil')k.threshold.value=v;if(p==='release')k.release.value=v/1000}}}},
 wam:{name:'WAM',hidden:true,params:[],
  make(c,f){const i=c.createGain(),o=c.createGain(),w=f&&c===ac?wamNode(f):null;
   if(w){i.connect(w);w.connect(o)}else i.connect(o);
   return{in:i,out:o,set(){},stop(){try{w&&w.disconnect()}catch{}}}}}
});
function chain(c,fx,inN,outN,live){
  let prev=inN;const insts=[];
  fx.forEach(f=>{if(live)f.inst=null;if(f.bypass)return;if(f.type==='wam'&&c!==ac)return;const p=PL[f.type],i=p.make(c,f);
    p.params.forEach(q=>{if(f.p[q.k]===undefined)f.p[q.k]=q.v;i.set(q.k,f.p[q.k])});prev.connect(i.in);prev=i.out;insts.push(i);if(live)f.inst=i});
  prev.connect(outN);return insts;
}
function rebuild(o){try{o.in.disconnect()}catch{}(o.insts||[]).forEach(i=>{try{i.out.disconnect()}catch{}i.stop&&i.stop()});o.insts=chain(ac,o.fx,o.in,o.outN,true)}
