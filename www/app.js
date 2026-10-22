const $=i=>document.getElementById(i),LS={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TH={orange:['#FF6B00','#FF8A33'],blue:['#00A8FF','#33BBFF'],crimson:['#E50914','#FF3344'],emerald:['#00C853','#33DD77'],purple:['#9C27B0','#BB44CC'],gold:['#FFD700','#FFE533']};
const ART={ggr:{n:'Goodbye & Good Riddance',a:['#FF3D6E','#FF8FAB'],bg:'#07040A',bgm:'rain',outfit:'ggr',wall:'radial-gradient(ellipse at 50% -10%,rgba(255,61,110,.35),transparent 60%),radial-gradient(ellipse at 100% 100%,rgba(90,20,140,.4),transparent 55%),linear-gradient(#07040a,#000)'},pne:{n:'The Party Never Ends',a:['#B24DFF','#FF4FD8'],bg:'#08030F',bgm:'confetti',outfit:'pne',wall:'radial-gradient(ellipse at 20% 0%,rgba(178,77,255,.4),transparent 55%),radial-gradient(ellipse at 90% 90%,rgba(255,79,216,.35),transparent 55%),linear-gradient(#0a0414,#000)'}};
let ACC='#FF6B00',ACC2='#FF8A33',theme=LS.get('rd_theme','orange');
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(t.h);t.h=setTimeout(()=>t.classList.remove('show'),2200)}
function hexA(h,a){const n=parseInt(h.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`}
function applyTheme(k){const t=TH[k]||(ART[k]&&ART[k].a);if(!t)return;theme=k;ACC=t[0];ACC2=t[1];const r=document.documentElement.style;r.setProperty('--accent',t[0]);r.setProperty('--accent2',t[1]);r.setProperty('--bg',ART[k]?ART[k].bg:'#000');LS.set('rd_theme',k);document.querySelectorAll('.swatch,.artt').forEach(s=>s.classList.toggle('on',s.dataset.k==k));document.dispatchEvent(new CustomEvent('rd-theme',{detail:k}))}
$('tg').innerHTML=Object.entries(TH).map(([k,t])=>`<div class="swatch" data-k="${k}" style="background:linear-gradient(135deg,#000 40%,${t[0]})"></div>`).join('');
document.querySelectorAll('.swatch').forEach(s=>s.onclick=()=>applyTheme(s.dataset.k));
$('bTheme').onclick=()=>$('tm').classList.add('show');
applyTheme(theme);
// tabs
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab,.panel').forEach(x=>x.classList.remove('on'));t.classList.add('on');$('p-'+t.dataset.p).classList.add('on')});
function chips(id,list,key,def,fn){const el=$(id);el.innerHTML=list.map(([v,l])=>`<div class="chip" data-v="${v}">${l}</div>`).join('');let cur=LS.get(key,def);const set=v=>{cur=v;LS.set(key,v);el.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c.dataset.v==v));fn(v)};el.querySelectorAll('.chip').forEach(c=>c.onclick=()=>set(c.dataset.v));set(cur);return set}
// edge lighting
chips('edc',[['off','Off'],['chase','Two-colour chase'],['flash','White flash'],['rainbow','Rainbow run']],'rd_edge','chase',v=>$('edge').className=v=='off'?'':v);
// floating backgrounds
let bm='rain',P=[],W=0,H=0;const bg=$('bg'),bx=bg.getContext('2d');
function initP(){P=[];const n={rain:90,bokeh:16,embers:55,smoke:7,confetti:70}[bm];for(let i=0;i<n;i++)P.push({x:Math.random()*W,y:Math.random()*H,r:Math.random(),s:.5+Math.random(),a:Math.random()*6,c:Math.floor(Math.random()*5)})}
function rs(){W=bg.width=innerWidth;H=bg.height=innerHeight;initP()}addEventListener('resize',rs);
const setBg=chips('bgc',[['rain','Rain'],['bokeh','Bokeh'],['embers','Embers'],['smoke','Smoke'],['confetti','Confetti']],'rd_bg','rain',v=>{bm=v;initP()});rs();
function bgFrame(){bx.clearRect(0,0,W,H);for(const p of P){
if(bm=='rain'){bx.strokeStyle=hexA(ACC,.25);bx.lineWidth=1;bx.beginPath();bx.moveTo(p.x,p.y);bx.lineTo(p.x-2,p.y+10+p.r*14);bx.stroke();p.y+=7+p.s*7;p.x-=.4;if(p.y>H){p.y=-20;p.x=Math.random()*W}}
else if(bm=='bokeh'){const r=22+p.r*50;bx.fillStyle=hexA(ACC,.07+p.r*.05);bx.beginPath();bx.arc(p.x,p.y,r,0,7);bx.fill();p.y-=.2*p.s;p.x+=Math.sin(p.a+=.004)*.3;if(p.y<-r){p.y=H+r;p.x=Math.random()*W}}
else if(bm=='embers'){bx.fillStyle=hexA(ACC,.3+p.r*.5);bx.beginPath();bx.arc(p.x,p.y,1+p.r*2,0,7);bx.fill();p.y-=.5+p.s;p.x+=Math.sin(p.a+=.03)*.6;if(p.y<-5){p.y=H+5;p.x=Math.random()*W}}
else if(bm=='confetti'){bx.save();bx.translate(p.x,p.y);bx.rotate(p.a);bx.fillStyle=hexA([ACC,ACC2,'#ffffff','#ffd54f','#4dd0e1'][p.c],.75);bx.fillRect(-3,-5*(.6+p.r),6,10*(.6+p.r));bx.restore();p.y+=1+p.s*1.6;p.x+=Math.sin(p.a)*.6;p.a+=.05;if(p.y>H+10){p.y=-10;p.x=Math.random()*W}}
else{const r=120+p.r*120,g=bx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,hexA(ACC,.09));g.addColorStop(1,hexA(ACC,0));bx.fillStyle=g;bx.fillRect(p.x-r,p.y-r,r*2,r*2);p.x+=.25*p.s;if(p.x>W+r)p.x=-r}}
requestAnimationFrame(bgFrame)}bgFrame();
// ===== audio engine (V1.1.0) =====
// Recording is ALWAYS the raw microphone: nothing is baked in. Presets + effects are applied when you PLAY or EXPORT a take.
// The backing track plays through the normal <audio> element (not through Web Audio), so the song stays clean and steady.
const aud=$('aud');let ctxA,analyser,td,micSrc;
let PB=null,recording=false,mr,chunks=[],stream,t0,tmr,ptmr,lastDur=0,cur0={id:null,name:''},recs=[],songs=[],curSong=null,keepMode=null,wl=null,exporting=false,seq=0;
const uid=()=>Date.now()*1000+(++seq%1000);
const fmt=e=>String(Math.floor(e/60)).padStart(2,'0')+':'+String(Math.floor(e%60)).padStart(2,'0')+'.'+Math.floor(e*10%10);
const fmtT=s=>{s=Math.round(s||0);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const BLANK='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#1c1c1c"/></svg>');
const strip=o=>{const c={...o};for(const k in c)if(k[0]=='_')delete c[k];return c};
const urlOf=o=>o._u||(o._u=URL.createObjectURL(o.blob));
const artOf=s=>s&&s.art?(s._a||(s._a=URL.createObjectURL(s.art))):BLANK;
function sw(id,key,def){const e=$(id);e.classList.toggle('on',!!LS.get(key,def));e.onclick=()=>{e.classList.toggle('on');LS.set(key,e.classList.contains('on'))}}

// presets: nr, ds, vc, cp, rv, bass, mid, treble, input gain %
const VP={flat:[0,0,0,0,0,0,0,0,100],plain:[40,15,55,45,0,-3,2,3,130],podcast:[35,20,45,40,0,-2,2,2,100],vocal:[25,35,60,55,15,-3,3,4,100],interview:[50,15,30,35,0,0,2,1,100],asmr:[70,40,70,20,25,3,1,2,100],music:[15,10,40,50,20,4,1,3,100],loud:[20,25,55,75,0,2,2,3,100]};
const VPN={plain:'Plain Vocal'};
const VS=[['nr','Noise reduction','%'],['ds','De-esser','%'],['vc','Voice clarity','%'],['cp','Compressor','%'],['rv','Reverb','%'],['eb','Bass','dB',-12,12],['em','Mid','dB',-12,12],['et','Treble','dB',-12,12]];
$('vs').innerHTML=VS.map(s=>`<div class="row"><div class="lb"><span>${s[1]}</span><b id="${s[0]}v"></b></div><input type="range" id="${s[0]}" min="${s[3]??0}" max="${s[4]??100}" value="0"></div>`).join('')+`<div class="row"><div class="lb"><span>Input gain</span><b id="gnv">100%</b></div><input type="range" id="gn" min="0" max="200" value="100"></div>`;
VS.concat([['gn','','%']]).forEach(s=>{$(s[0]).oninput=()=>{$(s[0]+'v').textContent=$(s[0]).value+s[2];apply()};$(s[0]).oninput()});
chips('vp',Object.keys(VP).map(k=>[k,VPN[k]||k[0].toUpperCase()+k.slice(1)]),'rd_vp','flat',v=>{VS.concat([['gn']]).forEach((s,i)=>{$(s[0]).value=VP[v][i];$(s[0]).oninput()})});
let fxp='none';chips('fxc',[['none','None'],['echo','Echo'],['chorus','Chorus'],['flanger','Flanger'],['bass','Bass boost'],['hall','Big hall']],'rd_fx','none',v=>{fxp=v;apply()});
$('fa').oninput=()=>{$('fai').textContent=$('fa').value+'%';apply()};$('fm').oninput=()=>{$('fmv').textContent=$('fm').value+'%';apply()};
$('bgVol').oninput=()=>{$('bgv').textContent=$('bgVol').value+'%';aud.volume=$('bgVol').value/100};$('bgVol').oninput();
$('sy').value=LS.get('rd_sy',0);$('sy').oninput=()=>{$('syv').textContent=$('sy').value;LS.set('rd_sy',+$('sy').value)};$('sy').oninput();
sw('swBg','rd_swbg',true);sw('swSp','rd_swsp',false);sw('swTk','rd_swtk',true);
// V1.3.0: two recording tracks (1 Main raps, 2 Ad-libs)
let TRK='main';
chips('trk',[['main','1 \u00b7 Main raps'],['adlib','2 \u00b7 Ad-libs']],'rd_trk','main',v=>{TRK=v;$('adBaseW').classList.toggle('hidden',v!='adlib');$('trkH').textContent=v=='adlib'?'Ad-libs: your Main take plays in your headphones while you record track 2. Use headphones. If the ad-libs sound late on playback, raise Ad-lib timing fix in the Mixer.':'Main: your main rap track, recorded with the backing track.'});

function ir(c){const n=c.sampleRate*2,b=c.createBuffer(2,n,c.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3)}return b}
function chainP(){const v=id=>+$(id).value;return{gn:v('gn')/100,nr:v('nr'),ds:v('ds'),vc:v('vc'),cp:v('cp'),rv:v('rv'),eb:v('eb'),em:v('em'),et:v('et'),fx:fxp,amt:v('fa')/100,mx:v('fm')/100}}
function isDry(p){return p.gn==1&&!p.nr&&!p.ds&&!p.vc&&!p.cp&&!p.rv&&!p.eb&&!p.em&&!p.et&&p.fx=='none'}
// one effects chain, used live (AudioContext) and for export (OfflineAudioContext)
function buildChain(c){
const bq=(t,f,Q)=>{const n=c.createBiquadFilter();n.type=t;n.frequency.value=f;if(Q)n.Q.value=Q;return n};
const g=c.createGain(),hp=bq('highpass',20),eb=bq('lowshelf',200),em=bq('peaking',1000,.8),et=bq('highshelf',5000),ds=bq('peaking',7000,2),vc=bq('peaking',3500,1),cp=c.createDynamicsCompressor();
const out=c.createGain(),dry=c.createGain(),wet=c.createGain(),dl=c.createDelay(1),fbg=c.createGain(),lfo=c.createOscillator(),lg=c.createGain(),cv=c.createConvolver(),rv=c.createGain();
cv.buffer=ir(c);
g.connect(hp);hp.connect(eb);eb.connect(em);em.connect(et);et.connect(ds);ds.connect(vc);vc.connect(cp);
cp.connect(dry);dry.connect(out);cp.connect(dl);dl.connect(fbg);fbg.connect(dl);dl.connect(wet);wet.connect(out);
lfo.connect(lg);lg.connect(dl.delayTime);lfo.start();cp.connect(cv);cv.connect(rv);rv.connect(out);
const set=p=>{g.gain.value=p.gn;hp.frequency.value=20+p.nr*1.8;ds.gain.value=-p.ds*.15;vc.gain.value=p.vc*.1;cp.threshold.value=-p.cp*.4;cp.ratio.value=1+p.cp*.1;
eb.gain.value=p.eb+(p.fx=='bass'?p.amt*10:0);em.gain.value=p.em;et.gain.value=p.et;rv.gain.value=p.rv/100*.8+(p.fx=='hall'?p.amt*p.mx*1.2:0);
let d=.25,fb=0,ld=0,lf=.5,w=0;
if(p.fx=='echo'){d=.15+p.amt*.35;fb=.2+p.amt*.4;w=p.mx}else if(p.fx=='chorus'){d=.025;ld=.008*p.amt;lf=.7;w=p.mx}else if(p.fx=='flanger'){d=.004;ld=.003*p.amt;lf=.25;fb=.5*p.amt;w=p.mx}
dl.delayTime.value=d;fbg.gain.value=fb;lg.gain.value=ld;lfo.frequency.value=lf;wet.gain.value=w};
set(chainP());
return{input:g,output:out,set,stop:()=>{try{lfo.stop()}catch(e){}}}}
function apply(){if(PB&&PB.chain)PB.chain.set(chainP())}
// one shared context: only used for the waveform while recording, and for playing takes through the effects
function getCtx(){if(!ctxA){ctxA=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'playback'});analyser=ctxA.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.6;td=new Uint8Array(2048)}return ctxA}

// waveform
const cv=$('wave'),cx=cv.getContext('2d');let cw,ch;
function rw(){const r=cv.getBoundingClientRect(),d=devicePixelRatio||1;cv.width=r.width*d;cv.height=r.height*d;cx.setTransform(d,0,0,d,0,0);cw=r.width;ch=r.height}addEventListener('resize',rw);rw();
const GRN='#00FF6A';
function drawW(){cx.fillStyle='#000';cx.fillRect(0,0,cw,ch);cx.strokeStyle='#0b2a17';cx.lineWidth=1;cx.beginPath();for(let i=1;i<8;i++){cx.moveTo(cw/8*i,0);cx.lineTo(cw/8*i,ch)}cx.moveTo(0,ch/2);cx.lineTo(cw,ch/2);cx.stroke();
if(analyser&&(recording||PB))analyser.getByteTimeDomainData(td);const n=td&&(recording||PB)?td.length:0,st=cw/512;
for(const [k,al,sc] of [[1,1,1],[-1,.35,.7]]){cx.beginPath();for(let i=0;i<512;i++){const v=n?(td[Math.floor(i*n/512)]-128)/128:0;const y=ch/2+k*v*ch*.5*sc;i?cx.lineTo(i*st,y):cx.moveTo(0,y)}cx.strokeStyle=hexA(GRN,al);cx.lineWidth=k>0?2:1;cx.shadowColor=GRN;cx.shadowBlur=k>0?10:0;cx.stroke()}cx.shadowBlur=0;requestAnimationFrame(drawW)}drawW();

// ---- storage: songs + takes stay saved inside the app (IndexedDB) ----
const DB={_d:null,open(){return this._d||(this._d=new Promise((res,rej)=>{const q=indexedDB.open('raindrops',1);q.onupgradeneeded=()=>{const d=q.result;d.createObjectStore('songs',{keyPath:'id'});d.createObjectStore('recs',{keyPath:'id'})};q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}))},
async tx(s,m,fn){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction(s,m),st=t.objectStore(s);let out;const r=fn(st);if(r)r.onsuccess=()=>{out=r.result};t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})},
put(s,o){return this.tx(s,'readwrite',st=>st.put(o))},async all(s){try{return await this.tx(s,'readonly',st=>st.getAll())}catch(e){const d=await this.open();return new Promise(res=>{const out=[],t=d.transaction(s,'readonly'),rq=t.objectStore(s).openCursor();rq.onsuccess=()=>{const c=rq.result;if(c){out.push(c.value);c.continue()}};t.oncomplete=()=>res(out);t.onerror=t.onabort=()=>res(out)})}},del(s,id){return this.tx(s,'readwrite',st=>st.delete(id))}};

// ---- keep alive: Android foreground service (native.js) + screen wake lock while recording ----
function updateKeep(){const want=recording?'record':(!aud.paused||PB||exporting)?'play':'live';awake(recording||exporting);if(want===keepMode)return;keepMode=want;try{want?(window.bgStart&&window.bgStart(want)):(window.bgStop&&window.bgStop())}catch(e){}}
async function awake(on){try{if(on&&navigator.wakeLock&&!wl){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null})}else if(!on&&wl){const w=wl;wl=null;await w.release()}}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='visible'){if(recording||exporting)awake(true);try{keepMode=null;updateKeep()}catch(e){}}});
// V1.9.5 error guard: a failed promise or script error is logged and toasted, never left to silently kill a feature
let _eT=0;window.addEventListener('error',e=>{try{console.error('[raindrops]',e.message,e.filename,e.lineno)}catch(x){}});
window.addEventListener('unhandledrejection',e=>{try{console.error('[raindrops] rejection',e.reason);const n=Date.now();if(n-_eT>4000){_eT=n;toast('Something failed: '+String((e.reason&&e.reason.message)||e.reason||'unknown').slice(0,80))}}catch(x){}});

// ---- UI state ----
function syncBtns(){document.querySelectorAll('[data-rid]').forEach(b=>b.textContent=PB&&PB.id==b.dataset.rid?'■':'▶');
document.querySelectorAll('[data-sid]').forEach(b=>b.textContent=!aud.paused&&curSong&&curSong.id==b.dataset.sid?'■':'▶');$('sPlay').textContent=aud.paused?'▶':'❚❚'}
function ui(){const rp=!!PB;$('bRec').classList.toggle('rec',recording);$('bPlay').disabled=recording||(!recs.length&&!rp);$('bPlay').textContent=rp?'■':'▶';$('bStop').disabled=!(recording||rp||!aud.paused);
$('dot').className='dot'+(recording?' rec':'');$('stt').textContent=recording?('Recording'+(cur0.t=='adlib'?' \u00b7 Ad-libs':'')):rp?'Playing take':!aud.paused?'Playing track':'Ready';syncBtns()}
function stopAll(){if(recording)stopRec();stopPlay();stopSong();ui()}

// ---- recording (raw mic) ----
$('bRec').onclick=()=>recording?stopRec():startRec();$('bStop').onclick=stopAll;
const mainOf=r=>r&&r.track=='adlib'&&r.baseId&&recs.find(x=>x.id==r.baseId)||r;
$('bPlay').onclick=()=>{if(PB)stopPlay();else if(recs[0])playR(mainOf(recs[0]).id)};
// V1.4.0: a take starts the backing track from the playhead (seek to a verse first). Last 3s counts as the end, so it falls back to the top.
const recOff=()=>(!PB&&curSong&&isFinite(aud.duration)&&aud.duration>4&&!aud.ended&&aud.currentTime<aud.duration-3)?Math.max(0,aud.currentTime||0):0;
async function startRec(){if(recording)return;if(window.rdEnsureMic&&!(await rdEnsureMic())){toast('Microphone blocked: allow it in App settings');try{rdOpenSettings()}catch(e){}return}const off0=recOff();stopPlay();stopSong();
try{let base=null;if(TRK=='adlib'){const v=$('adBase').value;base=v&&v!='none'?recs.find(x=>x.id==v):null}
const bgOn=!!(!base&&curSong&&$('swBg').classList.contains('on')),songOn=bgOn||!!(base&&base.bgId),aec=songOn&&$('swSp').classList.contains('on');
stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:aec,noiseSuppression:aec,autoGainControl:false,channelCount:{ideal:1}}});
try{const c=getCtx();await c.resume();micSrc=c.createMediaStreamSource(stream);micSrc.connect(analyser)}catch(e){}
if(base){await playR(base.id,{guide:true,hold:true});if(!PB||!PB.guide){stream.getTracks().forEach(t=>t.stop());try{micSrc&&micSrc.disconnect()}catch(e){}ui();return}}
const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(m=>MediaRecorder.isTypeSupported(m));
mr=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:192000}:{});chunks=[];cur0=base?{id:base.bgId||null,name:base.bgName||'',t:'adlib',b:base.id}:(bgOn?{id:curSong.id,name:curSong.title,t:TRK,b:null,off:off0}:{id:null,name:'',t:TRK,b:null});
mr.ondataavailable=e=>e.data.size&&chunks.push(e.data);mr.onstop=save;
mr.onstart=()=>{try{if(window.RdLat){RdLat.noteMic(stream);cur0.lat=RdLat.current()}}catch(e){}t0=Date.now();if(bgOn){aud.loop=true;try{aud.currentTime=off0}catch(e){}aud.play().catch(()=>{})}if(PB&&PB.guide&&PB.go)PB.go()};
mr.start(200);recording=true;t0=Date.now();$('time').textContent='00:00.0';ui();updateKeep();
tmr=setInterval(()=>{$('time').textContent=fmt((Date.now()-t0)/1000)},100)}
catch(e){recording=false;ui();toast('Mic blocked — allow it in app permissions')}}
function stopRec(){if(!recording)return;recording=false;if(PB&&PB.guide)stopPlay();lastDur=(Date.now()-t0)/1000;clearInterval(tmr);try{mr.stop()}catch(e){}try{micSrc&&micSrc.disconnect()}catch(e){}stream.getTracks().forEach(t=>t.stop());aud.pause();aud.loop=false;try{aud.currentTime=cur0.off||0}catch(e){}$('time').textContent='00:00.0';ui();updateKeep()}
async function save(){const mime=mr.mimeType||'audio/webm',blob=new Blob(chunks,{type:mime}),ext=mime.includes('mp4')?'m4a':mime.includes('ogg')?'ogg':'webm';
const r={id:uid(),name:(cur0.t=='adlib'?'Ad-lib ':'Take ')+new Date().toLocaleString(),blob,ext,mime,dur:lastDur,bgId:cur0.id,bgName:cur0.name,bgOff:cur0.off||0,created:Date.now(),track:cur0.t||'main',baseId:cur0.b||null,lat:cur0.lat!=null?cur0.lat:null};
recs.unshift(r);rRecs();ui();toast('Saved to Library');try{window.MX&&MX.afterRec(r.id)}catch(e){}
try{await DB.put('recs',strip(r))}catch(e){toast('Saved, but could not be stored permanently')}
try{window.notify&&notify('Take saved 🌧')}catch(e){}}
function rRecs(){$('rc').textContent=recs.length;$('recs').innerHTML=recs.map(r=>`<div class="item"><div class="n">${r.track=='adlib'?'🗣 ':''}${esc(r.name)}<small>${r.track=='adlib'?'AD-LIB · ':'MAIN · '}${Math.round(r.dur)}s · ${(r.blob.size/1048576).toFixed(2)}MB · ${r.ext}${r.bgName?' · 🎵 '+esc(r.bgName)+(r.bgOff>0.5?' @'+fmtT(r.bgOff):''):''}</small></div><button class="ib" data-rid="${r.id}" onclick="playR(${r.id})">▶</button><button class="ib" onclick="openE(${r.id})">⇩</button><button class="ib" onclick="delR(${r.id})">🗑</button></div>`).join('')||'<p style="color:var(--m);font-size:13px">Nothing recorded yet.</p>';fillBase();syncBtns();window.MX&&MX.refresh&&MX.refresh()}
function fillBase(){const sel=$('adBase'),keep=sel.value,mains=recs.filter(r=>r.track!='adlib');sel.innerHTML='<option value="none">No main take (just the song)</option>'+mains.map(r=>`<option value="${r.id}">Layer on: ${esc(r.name)}${r.bgName?' · 🎵 '+esc(r.bgName):''}</option>`).join('');sel.value=keep&&(keep=='none'||mains.some(r=>r.id==keep))?keep:(mains[0]?mains[0].id:'none')}
window.delR=async id=>{if(!confirm('Delete this take?'))return;if(PB&&PB.id==id)stopPlay();const r=recs.find(x=>x.id==id);if(r&&r._u)URL.revokeObjectURL(r._u);recs=recs.filter(x=>x.id!=id);try{await DB.del('recs',id)}catch(e){}rRecs();ui()};

// ---- playback of a take (voice through preset/effects, backing track on its own <audio>) ----
const ready=e=>new Promise(res=>{if(e.readyState>=3)return res();const f=()=>{e.removeEventListener('canplay',f);res()};e.addEventListener('canplay',f);setTimeout(f,4000)});
window.playR=async(id,o)=>{o=o||{};if(recording&&!o.guide){toast('Stop recording first');return}
if(PB&&PB.id==id&&!o.guide){stopPlay();return}
stopPlay();stopSong();const r=recs.find(x=>x.id==id);if(!r)return;
try{const c=getCtx();await c.resume();const el=new Audio();el.preload='auto';el.src=urlOf(r);
const src=c.createMediaElementSource(el),p=chainP(),pb={id,el,src,chain:null,timers:[],hasSong:false,guide:!!o.guide,ad:null,go:null};
let tail=src;if(window.MX){pb.chain=await MX.build(c);src.connect(pb.chain.input);tail=pb.chain.output}else if(!isDry(p)){pb.chain=buildChain(c);src.connect(pb.chain.input);tail=pb.chain.output}
if(window.RdRack&&RdRack.hook()&&!o.guide){pb.rack=RdRack.buildVoice(c);tail.connect(pb.rack.input);tail=pb.rack.output}
tail.connect(c.destination);if(!o.guide)tail.connect(analyser);pb.tail=tail;
// V1.3.0: track 2 (ad-libs) layered under/over the main take, own chain + volume + pan
const ar=(!o.guide&&r.track!='adlib'&&window.MX&&MX.adPick)?MX.adPick(r.id):null;let ad=null;
if(ar){const e2=new Audio();e2.preload='auto';e2.src=urlOf(ar);const s2=c.createMediaElementSource(e2),ch2=await MX.build(c,{tk:'adlib'});s2.connect(ch2.input);
const g2=c.createGain(),pn=c.createStereoPanner?c.createStereoPanner():null;g2.gain.value=MX.state.av/100;let o2=ch2.output,rk2=null;if(window.RdRack&&RdRack.hook()){rk2=RdRack.buildVoice(c,'ad');o2.connect(rk2.input);o2=rk2.output}o2.connect(g2);let t2=g2;if(pn){pn.pan.value=MX.state.ap/100;g2.connect(pn);t2=pn}
t2.connect(c.destination);t2.connect(analyser);ad={el:e2,src:s2,chain:ch2,rack:rk2,g:g2,pn,tail:t2};pb.ad=ad}
const sg=$('swTk').classList.contains('on')&&r.bgId?songs.find(s=>s.id==r.bgId):null;
if(sg){if(!curSong||curSong.id!=sg.id)setSong(sg);aud.loop=true;pb.hasSong=true}
await Promise.all([ready(el),ad?ready(ad.el):0,sg?ready(aud):0]);
if(ad){try{ad.el.currentTime=(MX.state.asy||0)/1000}catch(e){}}
PB=pb;try{window.RdBeat&&pb.hasSong&&!pb.guide&&RdBeat.live(c,pb)}catch(e){}const fin=()=>{if(PB&&PB.el===el){if(window.MX&&MX.state.loop){const i0=PB.id;stopPlay();setTimeout(()=>playR(i0),80)}else stopPlay()}};
el.onended=()=>{if(o.guide)return;if(ad&&!ad.el.ended&&!ad.el.paused)ad.el.onended=fin;else fin()};
const sync=(window.RdLat?RdLat.syncFor(r):+$('sy').value)/1000,dV=sg?Math.max(0,-sync):0,dS=sg?Math.max(0,sync):0;
const goV=()=>{el.play().catch(()=>{});if(ad)ad.el.play().catch(()=>{})},goS=()=>{try{aud.currentTime=r.bgOff||0}catch(e){}aud.play().catch(()=>{})};
pb.go=()=>{if(dV)pb.timers.push(setTimeout(goV,dV*1000));else goV();if(sg){if(dS)pb.timers.push(setTimeout(goS,dS*1000));else goS()}};
if(!o.hold)pb.go();
if(!o.guide)ptmr=setInterval(()=>{$('time').textContent=fmt(el.currentTime)},100);ui();updateKeep()}
catch(e){PB=null;ui();toast('Could not play this take')}};
window.adLive=()=>{if(PB&&PB.ad&&window.MX&&ctxA){const t=ctxA.currentTime;PB.ad.g.gain.setTargetAtTime(MX.state.av/100,t,.03);if(PB.ad.pn)PB.ad.pn.pan.setTargetAtTime(MX.state.ap/100,t,.03)}};
function stopPlay(){if(!PB)return;const p=PB;PB=null;p.timers.forEach(clearTimeout);clearInterval(ptmr);try{p.el.pause()}catch(e){}
try{p.src.disconnect();p.tail.disconnect();if(p.chain)p.chain.stop();if(p.rack)p.rack.stop()}catch(e){}p.el.removeAttribute('src');
if(p.ad){try{p.ad.el.pause();p.ad.el.onended=null;p.ad.src.disconnect();p.ad.chain.stop();if(p.ad.rack)p.ad.rack.stop();p.ad.g.disconnect();p.ad.tail.disconnect()}catch(e){}p.ad.el.removeAttribute('src')}
try{window.RdBeat&&RdBeat.unlive()}catch(e){}if(p.hasSong){aud.pause();aud.loop=false}$('time').textContent='00:00.0';ui();updateKeep()}

// ---- library: songs stay saved ----
$('bScan').onclick=()=>$('fScan').click();$('bFolder').onclick=()=>$('fFolder').click();
let importing=false;
[$('fScan'),$('fFolder')].forEach(f=>f.onchange=async e=>{
const a=[...e.target.files].filter(x=>x.type.startsWith('audio')||/\.(mp3|m4a|wav|ogg|flac|aac|opus)$/i.test(x.name));e.target.value='';
if(importing){toast('An import is already running');return}
if(!a.length){toast('No audio files in that selection');return}
importing=true;let n=0,skip=0,fail=0,why='';const tot=a.length;
try{for(let i=0;i<a.length;i++){const f=a[i];
try{
if(songs.some(s=>s.name==f.name&&s.size==f.size)){skip++;continue}
let m={};try{m=(await id3(f))||{}}catch(x){m={}}
let t=m.title,ar=m.artist;
if(!t){const b=f.name.replace(/\.\w+$/,''),x=b.split(' - ');if(x.length>1){ar=ar||x[0].trim();t=x.slice(1).join(' - ').trim()}else t=b}
const s={id:uid(),name:f.name,size:f.size,type:f.type,blob:f,title:t,artist:ar||'',art:m.artBlob||null,lyrics:m.lyrics||'',added:Date.now()};
songs.unshift(s);
try{await DB.put('songs',strip(s));n++}catch(x){songs.shift();fail++;why=String((x&&x.name)||x);if(/quota|full/i.test(why))break}
}catch(x){fail++;why=String((x&&x.message)||x)}
if((i+1)%10==0){toast('Importing '+(i+1)+' of '+tot+'…');rSongs()}
await new Promise(r=>setTimeout(r,25))}}finally{importing=false}
rSongs();toast(n+' saved'+(skip?', '+skip+' already in the app':'')+(fail?', '+fail+' failed'+(why?' ('+why.slice(0,40)+')':''):''))});
$('q').oninput=rSongs;
function rSongs(){const q=$('q').value.toLowerCase(),l=songs.filter(s=>(s.title+' '+s.artist+' '+s.name).toLowerCase().includes(q)).slice(0,300);$('sc').textContent=songs.length;
$('songs').innerHTML=l.map(s=>`<div class="item"><div class="n">${esc(s.title)}<small>${esc(s.artist||'Unknown artist')} · ${(s.size/1048576).toFixed(1)}MB</small></div><button class="ib" data-sid="${s.id}" onclick="toggleSong(${s.id})">▶</button><button class="ib" onclick="delS(${s.id})">🗑</button></div>`).join('')||`<p style="color:var(--m);font-size:13px">${songs.length?'No matches.':'No songs yet. Scan files or a folder — they stay saved in the app.'}</p>`;syncBtns()}
window.delS=async id=>{if(!confirm('Remove this song from the app?'))return;if(curSong&&curSong.id==id){stopSong();curSong=null;aud.removeAttribute('src');$('bgName').textContent='Pick one from Library — it records with you';$('mt').textContent='Nothing loaded';$('ma').textContent='Pick a song in Library';$('art').src=BLANK;lyrics('')}
const s=songs.find(x=>x.id==id);if(s){if(s._u)URL.revokeObjectURL(s._u);if(s._a)URL.revokeObjectURL(s._a)}songs=songs.filter(x=>x.id!=id);try{await DB.del('songs',id)}catch(e){}rSongs();ui()};
function setSong(s){curSong=s;aud.src=urlOf(s);aud.load();aud.volume=$('bgVol').value/100;$('bgName').textContent='🎵 '+s.title;$('mt').textContent=s.title;$('ma').textContent=s.artist||'Unknown artist';$('art').src=artOf(s);
$('sq').value=((s.artist?s.artist+' ':'')+s.title).trim();$('bq').value=s.artist||'';lyrics(s.lyrics||'');
try{if('mediaSession' in navigator){navigator.mediaSession.metadata=new MediaMetadata({title:s.title,artist:s.artist||'',artwork:s.art?[{src:artOf(s),sizes:'512x512',type:s.art.type||'image/jpeg'}]:[]});
navigator.mediaSession.setActionHandler('play',()=>aud.play());navigator.mediaSession.setActionHandler('pause',()=>aud.pause());navigator.mediaSession.setActionHandler('stop',()=>stopAll())}}catch(e){}}
window.toggleSong=async id=>{if(recording){toast('Stop recording first');return}const s=songs.find(x=>x.id==id);if(!s)return;if(PB)stopPlay();
if(curSong&&curSong.id==id&&!aud.paused){stopSong();return}
if(!curSong||curSong.id!=id)setSong(s);aud.loop=false;$('side').classList.add('show');lyrK=-2;try{await aud.play();toast('Playing — tap ■ to stop')}catch(e){toast('Cannot play this file')}};
function stopSong(){try{aud.pause();aud.currentTime=0}catch(e){}aud.loop=false;lyrK=-2;lyrSync()}
['play','pause','ended'].forEach(ev=>aud.addEventListener(ev,()=>{ui();updateKeep()}));
aud.addEventListener('error',()=>{if(aud.getAttribute('src'))toast('Cannot play this file')});
aud.addEventListener('timeupdate',()=>{lyrSync();seekUI()});
aud.addEventListener('loadedmetadata',()=>{seekUI();if(curSong&&!curSong.lyrics&&!curSong._ly&&!PB){curSong._ly=1;autoLyr(true)}});

// ---- ID3 tags (title, artist, cover art, embedded lyrics) ----
function skip(d,j,e){if(e==1||e==2){while(j<d.length-1&&(d[j]||d[j+1]))j+=2;return j+2}while(j<d.length&&d[j])j++;return j+1}
async function id3(f){const b=new Uint8Array(await f.slice(0,3e6).arrayBuffer()),r={};if(String.fromCharCode(b[0],b[1],b[2])!='ID3')return r;
const v=b[3],end=10+((b[6]&127)<<21|(b[7]&127)<<14|(b[8]&127)<<7|(b[9]&127));let i=10;
const dec=(a,e)=>new TextDecoder(e==1?'utf-16':e==2?'utf-16be':e==3?'utf-8':'iso-8859-1').decode(a).replace(/\0/g,'');
while(i+10<end&&i+10<b.length){const id=String.fromCharCode(b[i],b[i+1],b[i+2],b[i+3]);if(!/^[A-Z0-9]{4}$/.test(id))break;
const sz=v==4?((b[i+4]&127)<<21|(b[i+5]&127)<<14|(b[i+6]&127)<<7|(b[i+7]&127)):(b[i+4]*16777216+b[i+5]*65536+b[i+6]*256+b[i+7]);
const d=b.slice(i+10,i+10+sz),e=d[0];i+=10+sz;
if(id=='TIT2')r.title=dec(d.slice(1),e);else if(id=='TPE1')r.artist=dec(d.slice(1),e);
else if(id=='USLT')r.lyrics=dec(d.slice(skip(d,4,e)),e);
else if(id=='APIC'){let j=1;while(d[j])j++;const mime=dec(d.slice(1,j),0);j+=2;j=skip(d,j,e);r.artBlob=new Blob([d.slice(j)],{type:mime||'image/jpeg'})}}return r}

// ---- lyrics flow with the song ----
let L=[],timed=false,lyrK=-1;
function lyrics(t){L=[];timed=false;lyrK=-1;
String(t||'').split(/\r?\n/).forEach(l=>{const ts=[...l.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)],x=l.replace(/\[[^\]]*\]/g,'').trim();
if(ts.length){timed=true;if(x)ts.forEach(m=>L.push({t:+m[1]*60+ +m[2].replace(':','.'),x}))}else if(x)L.push({t:null,x})});
if(timed)L=L.filter(l=>l.t!=null).sort((a,b)=>a.t-b.t);
$('lyr').innerHTML=L.map((l,i)=>`<p id="l${i}">${esc(l.x)}</p>`).join('')||'<p>No lyrics yet. Tap Find, or load a .lrc (timed) or .txt file.</p>';$('lyr').scrollTop=0;lyrSync()}
function lyrSync(){if(!L.length)return;const ct=aud.currentTime||0;let k=-1;
if(timed){for(let i=0;i<L.length;i++){if(L[i].t<=ct)k=i;else break}}else if(aud.duration)k=Math.min(L.length-1,Math.floor(ct/aud.duration*L.length));
if(k===lyrK)return;lyrK=k;const box=$('lyr');box.querySelectorAll('p.cur').forEach(p=>p.classList.remove('cur'));const el=$('l'+k);
if(el){el.classList.add('cur');if($('side').classList.contains('show'))box.scrollTo({top:el.offsetTop-box.clientHeight/2+el.offsetHeight/2,behavior:'smooth'})}}
$('lyr').onclick=e=>{const p=e.target.closest('p');if(p&&timed&&!PB&&p.id[0]=='l'&&L[+p.id.slice(1)])aud.currentTime=L[+p.id.slice(1)].t};
function seekUI(){const d=aud.duration||0;$('sSeek').value=d?aud.currentTime/d*1000:0;$('sTime').textContent=fmtT(aud.currentTime)+' / '+fmtT(d)}
$('sSeek').oninput=()=>{if(PB||!aud.duration)return;aud.currentTime=$('sSeek').value/1000*aud.duration};
$('sPlay').onclick=()=>{if(!curSong){toast('Pick a song in Library');return}if(PB||recording)return;aud.paused?aud.play().catch(()=>toast('Cannot play this file')):aud.pause()};
$('sStop').onclick=stopAll;
$('bLrc').onclick=()=>$('fLrc').click();$('fLrc').onchange=async e=>{const f=e.target.files[0];if(!f)return;const t=await f.text();applyLy(t,null);e.target.value=''};
$('bSide').onclick=()=>{$('side').classList.toggle('show');lyrK=-2;lyrSync()};$('bX').onclick=()=>$('side').classList.remove('show');
document.querySelectorAll('#sv .chip').forEach(c=>c.onclick=()=>{document.querySelectorAll('#sv .chip').forEach(x=>x.classList.toggle('on',x==c));['lyr','vFind','vBio'].forEach(i=>$(i).classList.toggle('hidden',i!=c.dataset.v));if(c.dataset.v=='vBio')bio($('bq').value||(curSong&&curSong.artist)||'')});
function applyLy(text,hit){lyrics(text);if(curSong){curSong.lyrics=text;if(hit&&!curSong.artist)curSong.artist=hit.artistName||'';$('ma').textContent=curSong.artist||'Unknown artist';DB.put('songs',strip(curSong)).catch(()=>{});rSongs()}}
async function jget(url){const H=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.CapacitorHttp;
if(typeof NATIVE!=='undefined'&&NATIVE&&H){const r=await H.get({url,connectTimeout:12000,readTimeout:12000});if(r.status>=400)throw new Error('HTTP '+r.status);return typeof r.data=='string'?JSON.parse(r.data):r.data}
const r=await fetch(url);if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
// lyrics search (LRCLIB) + recent searches
let HITS=[];
function hist(q){let h=LS.get('rd_sh',[]).filter(x=>x!=q);h.unshift(q);h=h.slice(0,8);LS.set('rd_sh',h);rHist()}
function rHist(){const h=LS.get('rd_sh',[]);$('shist').innerHTML=h.map(x=>`<div class="chip" data-q="${esc(x)}">${esc(x)}</div>`).join('')||'<span class="hint">None yet.</span>';$('shist').querySelectorAll('.chip').forEach(c=>c.onclick=()=>{$('sq').value=c.dataset.q;lrSearch(c.dataset.q)})}
async function lrSearch(q){q=(q||'').trim();if(!q)return;hist(q);$('sres').innerHTML='<p class="hint">Searching…</p>';
try{const r=await jget('https://lrclib.net/api/search?q='+encodeURIComponent(q));HITS=(r||[]).filter(x=>x.plainLyrics||x.syncedLyrics).slice(0,15);
$('sres').innerHTML=HITS.map((x,i)=>`<div class="item" onclick="useHit(${i})"><div class="n">${esc(x.trackName)}<small>${esc(x.artistName)}${x.albumName?' · '+esc(x.albumName):''} · ${fmtT(x.duration)} · ${x.syncedLyrics?'synced':'text only'}</small></div></div>`).join('')||'<p class="hint">Nothing found. Try artist + song name.</p>'}
catch(e){$('sres').innerHTML='<p class="hint">Search failed — needs internet. '+esc(e.message||'')+'</p>'}}
window.useHit=i=>{const x=HITS[i];if(!x)return;applyLy(x.syncedLyrics||x.plainLyrics||'',x);document.querySelector('#sv .chip[data-v=lyr]').click();toast(curSong?'Lyrics saved to '+curSong.title:'Lyrics loaded')};
$('sGo').onclick=()=>lrSearch($('sq').value);$('sq').onkeydown=e=>{if(e.key=='Enter')lrSearch($('sq').value)};
async function autoLyr(silent){const s=curSong;if(!s)return;const q=((s.artist?s.artist+' ':'')+s.title).trim();if(!silent)toast('Searching lyrics…');
try{const all=window.RDlyrics?await RDlyrics.find({artist:s.artist||'',title:s.title,dur:aud.duration||0}):((await jget('https://lrclib.net/api/search?q='+encodeURIComponent(q)))||[]).filter(x=>x.syncedLyrics||x.plainLyrics);if(curSong!==s)return;const d=aud.duration||0;
const close=d?all.filter(x=>!x.duration||Math.abs(x.duration-d)<=4):all;
const best=close.find(x=>x.syncedLyrics)||close[0]||(silent?null:(all.find(x=>x.syncedLyrics)||all[0]));
if(best){applyLy(best.syncedLyrics||best.plainLyrics,best);toast('Lyrics found: '+best.trackName)}else if(!silent)toast('No lyrics found — try the Find tab')}
catch(e){if(!silent)toast('Lyrics search needs internet')}}
$('sAuto').onclick=()=>{if(!curSong){toast('Pick a song first');return}autoLyr(false)};
// artist history (Wikipedia intro, saved after first look-up)
function showBio(d){$('bioOut').innerHTML=(d.i?`<img src="${esc(d.i)}" alt="" style="width:100%;max-width:200px;border-radius:12px;margin-bottom:10px">`:'')+`<div style="font-weight:800;margin-bottom:6px">${esc(d.t)}</div>`+d.x.split('\n').filter(Boolean).map(p=>`<p class="bp">${esc(p)}</p>`).join('')+'<p class="hint">Source: Wikipedia</p>'}
async function bio(a){a=(a||'').trim();if(!a){$('bioOut').innerHTML='<p class="hint">Type an artist name.</p>';return}$('bq').value=a;const k='rd_bio_'+a.toLowerCase(),c=LS.get(k,null);if(c)showBio(c);else $('bioOut').innerHTML='<p class="hint">Looking up…</p>';
try{const r=await jget('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=300&generator=search&gsrlimit=1&gsrsearch='+encodeURIComponent(a+' musician'));
const pg=r&&r.query&&Object.values(r.query.pages)[0];if(!pg||!pg.extract){if(!c)$('bioOut').innerHTML='<p class="hint">No history found for “'+esc(a)+'”.</p>';return}
const d={t:pg.title,x:pg.extract.slice(0,4000),i:(pg.thumbnail&&pg.thumbnail.source)||''};LS.set(k,d);showBio(d)}
catch(e){if(!c)$('bioOut').innerHTML='<p class="hint">Look-up failed — needs internet.</p>'}}
$('bGo').onclick=()=>bio($('bq').value);$('bq').onkeydown=e=>{if(e.key=='Enter')bio($('bq').value)};rHist();

// ---- export: audio (WAV / raw), video (art + waveform), optional album art ----
let et,ef='wav',art=null,busy=false,cancelX=false;
const loadImg=b=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=URL.createObjectURL(b)});
function eNote(){$('ap').textContent=art?'Album art: '+art.name+(ef=='vid'?' (used as the video picture)':' (saved/shared as a separate image next to the audio)'):(ef=='vid'?'No album art picked: the track\u2019s own art is used, or a plain Raindrops picture.':'No album art. Pick an image to attach it next to the audio.')}
window.openE=id=>{et=recs.find(x=>x.id==id);if(!et)return;$('en').value=et.name.replace(/[^\w]+/g,'_');art=null;eNote();const has=!!(et.bgId&&songs.some(s=>s.id==et.bgId));$('eTr').classList.toggle('hidden',!has);const hasAd=!!(et.track!='adlib'&&window.MX&&MX.adPick&&MX.adPick(et.id));$('eAd').classList.toggle('hidden',!hasAd);$('swEa').classList.toggle('on',hasAd);$('swEt').classList.toggle('on',has);$('swEf').classList.toggle('on',!!(window.MX&&!MX.isDry()));$('eOpts').classList.toggle('hidden',ef=='raw');$('exp').classList.add('show')};
$('eX').onclick=()=>{if(busy){cancelX=true;$('ep2').textContent='Cancelling…';return}$('exp').classList.remove('show')};
document.querySelectorAll('#ef .chip').forEach(c=>c.onclick=()=>{ef=c.dataset.f;document.querySelectorAll('#ef .chip').forEach(x=>x.classList.toggle('on',x==c));$('eOpts').classList.toggle('hidden',ef=='raw');eNote()});
$('swEt').onclick=()=>$('swEt').classList.toggle('on');$('swEa').onclick=()=>$('swEa').classList.toggle('on');$('swEf').onclick=()=>$('swEf').classList.toggle('on');
$('fArt').onchange=e=>{art=e.target.files[0]||null;eNote()};
function dl(b,n){const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;document.body.appendChild(a);a.click();a.remove()}
async function shareB(fl){if(navigator.canShare&&navigator.share){try{await navigator.share({files:fl.map(([b,n])=>new File([b],n,{type:b.type}))});return}catch(e){if(e.name=='AbortError')return}}toast('Sharing works in the Android app')}
async function renderMix(r,o){const SR=48000,D=new OfflineAudioContext(2,1,SR),dec=async b=>D.decodeAudioData(await b.arrayBuffer());
const v=await dec(r.blob);let ab=null;const ar=o.ad&&r.track!='adlib'&&window.MX&&MX.adPick?MX.adPick(r.id):null;if(ar){try{ab=await dec(ar.blob)}catch(e){toast('Ad-libs could not be mixed — main only')}}const s0=o.song&&r.bgId?songs.find(x=>x.id==r.bgId):null;let sb=null;
if(s0){try{sb=await dec(s0.blob)}catch(e){toast('Track could not be mixed — voice only')}}
const useFx=o.fx&&window.MX&&(!MX.isDry()||(window.RdRack&&RdRack.voiceOn())),sync=sb?((window.RdLat?RdLat.syncFor(r):+$('sy').value)/1000):0,vAt=Math.max(0,-sync),sAt=Math.max(0,sync),tail=useFx?MX.tail()+(window.RdRack?RdRack.tail():0):.1;
const asy=ab?Math.min((MX.state.asy||0)/1000,Math.max(0,ab.duration-.05)):0,total=vAt+Math.max(v.duration,ab?ab.duration-asy:0)+tail,off=new OfflineAudioContext(2,Math.ceil(total*SR),SR),vs=off.createBufferSource();vs.buffer=v;
if(useFx){const c=await MX.build(off);vs.connect(c.input);let t0=c.output;if(window.RdRack&&RdRack.voiceOn()){const rk=RdRack.buildVoice(off);t0.connect(rk.input);t0=rk.output}t0.connect(off.destination)}else vs.connect(off.destination);vs.start(vAt);
if(ab){const as=off.createBufferSource(),g=off.createGain(),pn=off.createStereoPanner?off.createStereoPanner():null;as.buffer=ab;g.gain.value=MX.state.av/100;let t=g;if(pn){pn.pan.value=MX.state.ap/100;g.connect(pn);t=pn}t.connect(off.destination);if(useFx){const c2=await MX.build(off,{tk:'adlib'});as.connect(c2.input);let t2=c2.output;if(window.RdRack&&RdRack.voiceOn()&&RdRack.adOn()){const rk2=RdRack.buildVoice(off,'ad');t2.connect(rk2.input);t2=rk2.output}t2.connect(g)}else as.connect(g);as.start(vAt,asy)}
if(sb){const ss=off.createBufferSource(),g=off.createGain();ss.buffer=sb;ss.loop=true;g.gain.value=$('bgVol').value/100;if(window.RdBeat&&RdBeat.on()){const bc=RdBeat.build(off);ss.connect(bc.input);bc.output.connect(g);bc.duckCurve(v,vAt)}else ss.connect(g);g.connect(off.destination);ss.start(sAt,(r.bgOff||0)%sb.duration);ss.stop(total)}
return await off.startRendering()}
function wav(ab){const c=ab.numberOfChannels,sr=ab.sampleRate,len=ab.length,buf=new ArrayBuffer(44+len*c*2),v=new DataView(buf),w=(o,s)=>[...s].forEach((ch,i)=>v.setUint8(o+i,ch.charCodeAt(0)));
w(0,'RIFF');v.setUint32(4,36+len*c*2,true);w(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,c,true);v.setUint32(24,sr,true);v.setUint32(28,sr*c*2,true);v.setUint16(32,c*2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,len*c*2,true);
const ch=[...Array(c)].map((_,i)=>ab.getChannelData(i));let pk=0;for(const d of ch)for(let i=0;i<len;i++){const a=Math.abs(d[i]);if(a>pk)pk=a}const k=pk>1?.98/pk:1;
let o=44;for(let i=0;i<len;i++)for(let j=0;j<c;j++){const s=Math.max(-1,Math.min(1,ch[j][i]*k));v.setInt16(o,s<0?s*32768:s*32767,true);o+=2}return new Blob([buf],{type:'audio/wav'})}
// V1.3.0 video: 480p MP4 at 15 fps. Fast path = WebCodecs (H.264 + AAC) + own MP4 muxer, encodes much faster than real time and ~10x smaller.
// Fallback = the old MediaRecorder real-time render, now also 480p / 15 fps / low bitrate.
function paintVid(g,W,H,img,meta,vals){const k=W/720,gr=g.createLinearGradient(0,0,0,H);gr.addColorStop(0,hexA(ACC,.35));gr.addColorStop(1,'#000');g.fillStyle='#000';g.fillRect(0,0,W,H);g.fillStyle=gr;g.fillRect(0,0,W,H);
const S=420*k,x=(W-S)/2,y=50*k;
if(img){const q=Math.max(S/img.width,S/img.height),w=img.width*q,h=img.height*q;g.save();g.beginPath();if(g.roundRect)g.roundRect(x,y,S,S,24*k);else g.rect(x,y,S,S);g.clip();g.drawImage(img,x+(S-w)/2,y+(S-h)/2,w,h);g.restore()}
else{g.fillStyle=hexA(ACC,.25);g.fillRect(x,y,S,S);g.fillStyle=ACC;g.font='900 '+Math.round(200*k)+'px system-ui';g.textAlign='center';g.fillText('999',W/2,y+S/2+70*k)}
g.textAlign='center';g.fillStyle='#fff';g.font='800 '+Math.round(34*k)+'px system-ui';g.fillText(meta.title,W/2,y+S+55*k,W-60*k);g.fillStyle='#aaa';g.font='600 '+Math.round(22*k)+'px system-ui';g.fillText(meta.artist,W/2,y+S+90*k,W-60*k);
const n=vals.length,bw=(W-80*k)/n;for(let i=0;i<n;i++){const h=4*k+vals[i]*110*k;g.fillStyle=ACC;g.fillRect(40*k+i*bw,H-30*k-h,bw-3*k,h)}}
const loadJS=u=>new Promise((res,rej)=>{const e=document.createElement('script');e.src=u;e.onload=res;e.onerror=()=>rej(new Error('could not load '+u));document.head.appendChild(e)});
let MBp=null;const mbLoad=()=>MBp||(MBp=(async()=>{await loadJS('lib/mediabunny.js');await loadJS('lib/mediabunny-aac-encoder.js')})().catch(e=>{MBp=null;throw e}));
// V1.4.0: Mediabunny muxer + built-in AAC encoder (used when the phone's WebView cannot encode AAC) + WebCodecs video. Audio and video encode at the same time.
const nap=()=>new Promise(r=>setTimeout(r,0));
async function makeVideoFast(mix,img,meta,prog){
if(!(window.VideoEncoder&&window.VideoFrame))throw new Error('this WebView has no video encoder');
const W=480,H=480,FPS=6,SR=mix.sampleRate,NCH=2,AB=128000;
prog('Loading encoder…');await mbLoad();const MB=window.Mediabunny;
if(!(await MB.canEncodeAudio('aac',{numberOfChannels:NCH,sampleRate:SR,bitrate:AB})))window.MediabunnyAacEncoder.registerAacEncoder();
let vc=null;for(const c of ['avc','vp9']){try{if(await MB.canEncodeVideo(c,{width:W,height:H,bitrate:350000,frameRate:FPS})){vc=c;break}}catch(e){}}
if(!vc)throw new Error('no H.264/VP9 video encoder in this WebView');
const cvs=document.createElement('canvas');cvs.width=W;cvs.height=H;const g=cvs.getContext('2d');
const out=new MB.Output({format:new MB.Mp4OutputFormat(),target:new MB.BufferTarget()}),vs=new MB.CanvasSource(cvs,{codec:vc,bitrate:350000,keyFrameInterval:3}),as=new MB.AudioSampleSource({codec:'aac',bitrate:AB});
out.addVideoTrack(vs,{frameRate:FPS});out.addAudioTrack(as);
const L=mix.getChannelData(0),R=mix.numberOfChannels>1?mix.getChannelData(1):L,total=mix.length;
try{await out.start();
// one thing at a time (audio, then picture), small chunks, and a pause now and then so the phone never locks up
const CH=SR*4;
for(let i=0,j=0;i<total;i+=CH,j++){if(cancelX)throw new Error('cancelled');const n=Math.min(CH,total-i),d=new Float32Array(n*NCH);d.set(L.subarray(i,i+n),0);d.set(R.subarray(i,i+n),n);
const sm=new MB.AudioSample({data:d,format:'f32-planar',numberOfChannels:NCH,sampleRate:SR,timestamp:i/SR});await as.add(sm);sm.close();prog('Encoding audio '+Math.round(i/total*100)+'%');await nap()}
as.close();
const NB=48,N=1024,cf=[];for(let b=0;b<NB;b++)cf.push(2*Math.cos(2*Math.PI*60*Math.pow(8000/60,b/(NB-1))/SR));
const sm=new Float32Array(NB),vals=new Array(NB).fill(0);
const spec=pos=>{if(L.length<N)return;const a=Math.max(0,Math.min(L.length-N,pos-(N>>1)));
for(let b=0;b<NB;b++){let s1=0,s2=0;const c=cf[b];for(let i=0;i<N;i++){const x=(L[a+i]+R[a+i])*.5,s0=x+c*s1-s2;s2=s1;s1=s0}
const p=s1*s1+s2*s2-c*s1*s2,m=Math.sqrt(Math.max(0,p))/(N/2),v=Math.max(0,Math.min(1,(20*Math.log10(m+1e-7)+66)/50))*(.75+.25*b/(NB-1));sm[b]=Math.max(v,sm[b]*.82);vals[b]=sm[b]}};
const nf=Math.max(1,Math.ceil(mix.duration*FPS));
for(let f=0;f<nf;f++){if(cancelX)throw new Error('cancelled');spec(Math.floor(f/FPS*SR));paintVid(g,W,H,img,meta,vals);await vs.add(f/FPS,1/FPS);if(f%6==0){prog('Encoding video '+Math.round(f/nf*100)+'%');await nap()}}
vs.close();prog('Packing MP4…');await out.finalize();
return new Blob([out.target.buffer],{type:'video/mp4'})}
catch(e){try{await out.cancel()}catch(x){}throw e}}
async function makeVideo(mix,img,meta,prog){const W=480,H=480,cvs=document.createElement('canvas');cvs.width=W;cvs.height=H;const g=cvs.getContext('2d');
if(!window.MediaRecorder)throw new Error('video recording not supported here');
const mt=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));if(!mt)throw new Error('video recording not supported here');
const c=getCtx();await c.resume();const dst=c.createMediaStreamDestination(),an=c.createAnalyser();an.fftSize=256;const bins=new Uint8Array(an.frequencyBinCount),src=c.createBufferSource();src.buffer=mix;src.connect(dst);src.connect(an);
const ms=new MediaStream([...cvs.captureStream(15).getVideoTracks(),...dst.stream.getAudioTracks()]),rec=new MediaRecorder(ms,{mimeType:mt,videoBitsPerSecond:450000,audioBitsPerSecond:96000}),parts=[];
rec.ondataavailable=e=>e.data.size&&parts.push(e.data);
const draw=()=>{an.getByteFrequencyData(bins);const vals=[];for(let i=0;i<48;i++)vals.push(bins[Math.floor(i*bins.length*.7/48)]/255);paintVid(g,W,H,img,meta,vals)};
return new Promise((res,rej)=>{let iv;const ts=performance.now(),dur=mix.duration;
rec.onstop=()=>{clearInterval(iv);try{src.disconnect()}catch(e){}res(new Blob(parts,{type:mt.split(';')[0]}))};rec.onerror=e=>{clearInterval(iv);rej(e.error||new Error('recorder error'))};
src.onended=()=>setTimeout(()=>{try{rec.stop()}catch(e){}},400);
draw();rec.start(1000);src.start();iv=setInterval(()=>{draw();prog('Rendering video '+fmtT(Math.min(dur,(performance.now()-ts)/1000))+' / '+fmtT(dur)+' — keep the app open')},66)})}
async function exportTake(share){if(busy||!et)return;busy=true;cancelX=false;exporting=true;updateKeep();const n=($('en').value||'take').replace(/[^\w\-]+/g,'_'),prog=m=>{$('ep2').textContent=m};
try{let b,x;const s=et.bgId&&songs.find(z=>z.id==et.bgId);
if(ef=='raw'){b=et.blob;x=et.ext}
else{prog('Mixing…');const mix=await renderMix(et,{song:$('swEt').classList.contains('on'),fx:$('swEf').classList.contains('on'),ad:$('swEa').classList.contains('on')});
if(ef=='wav'){b=wav(mix);x='wav'}
else{let img=null;try{img=art?await loadImg(art):(s&&s.art?await loadImg(s.art):null)}catch(e){}
const meta={title:s?s.title:et.name,artist:s?(s.artist||'Raindrops'):'Raindrops'};
try{b=await makeVideoFast(mix,img,meta,prog);x='mp4'}catch(e){const why=String((e&&e.message)||e).slice(0,140);console.error('fast video failed',e);if(cancelX)throw new Error('cancelled');if(!confirm('Fast video export failed: '+why+'\n\nThe slow fallback renders in real time, so it takes as long as the song ('+fmtT(mix.duration)+'). Run it anyway?'))throw new Error('video cancelled ('+why+')');prog('Rendering in real time…');b=await makeVideo(mix,img,meta,prog);x=b.type.includes('mp4')?'mp4':'webm'}}}
const cn=art&&ef!='vid'?n+'_cover.'+((art.name.split('.').pop())||'jpg'):null;
if(share){await shareB(cn?[[b,n+'.'+x],[art,cn]]:[[b,n+'.'+x]])}else{await dl(b,n+'.'+x);if(cn)setTimeout(()=>dl(art,cn),400)}
$('exp').classList.remove('show')}
catch(e){toast(/cancelled/.test(String((e&&e.message)||e))?'Export cancelled':'Export failed: '+((e&&e.message)||e))}
finally{busy=false;exporting=false;$('ep2').textContent='';updateKeep()}}
$('eGo').onclick=()=>exportTake(false);$('eSh').onclick=()=>exportTake(true);

// ---- boot: load saved songs + takes ----
(async()=>{try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
try{songs=(await DB.all('songs')).sort((a,b)=>b.added-a.added);recs=(await DB.all('recs')).sort((a,b)=>b.created-a.created)}catch(e){toast('Library load failed: '+String((e&&e.message)||e).slice(0,70))}
rSongs();rRecs();ui();seekUI();
try{const R=LS.get('rd_resume',null);if(R&&Date.now()-R.at<864e5){if(R.tab){const tb=document.querySelector('.tab[data-p="'+R.tab+'"]');if(tb)tb.click()}
const s=R.sid&&songs.find(x=>x.id==R.sid);if(s&&!curSong){setSong(s);if(R.t>1)aud.addEventListener('loadedmetadata',()=>{try{aud.currentTime=R.t}catch(x){}},{once:true})}}}catch(e){}
try{updateKeep()}catch(e){}
const saveR=()=>{try{const tb=document.querySelector('.tab.on');LS.set('rd_resume',{at:Date.now(),tab:tb&&tb.dataset.p,sid:curSong&&curSong.id,t:aud.currentTime||0})}catch(e){}};
setInterval(saveR,4000);window.addEventListener('pagehide',saveR);document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='hidden')saveR()})})();

// notes
let notes=LS.get('rd_notes',[]),nid=null;
function rNotes(){$('nl').innerHTML=notes.map(n=>`<div class="item" onclick="openN(${n.id})"><div class="n">${esc(n.t||'Untitled')}<small>${esc(n.b.slice(0,50))}</small></div></div>`).join('')||'<p style="color:var(--m);font-size:13px">No notes yet.</p>'}
window.openN=id=>{const n=notes.find(x=>x.id==id);nid=id;$('nt').value=n.t;$('nb').value=n.b;scrollTo(0,0)};
$('nSave').onclick=()=>{const t=$('nt').value,b=$('nb').value;if(!t&&!b)return;if(nid){const n=notes.find(x=>x.id==nid);n.t=t;n.b=b}else{nid=Date.now();notes.unshift({id:nid,t,b})}LS.set('rd_notes',notes);rNotes();toast('Note saved')};
$('nNew').onclick=()=>{nid=null;$('nt').value='';$('nb').value=''};
$('nDel').onclick=()=>{if(!nid||!confirm('Delete this note?'))return;notes=notes.filter(x=>x.id!=nid);LS.set('rd_notes',notes);$('nNew').click();rNotes()};rNotes();
// permissions
async function perms(){let m='Mic: ',n='';try{const s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(t=>t.stop());m+='OK'}catch(e){m+='blocked'}
try{n=' · Notifications: '+await Notification.requestPermission()}catch(e){n=' · Notifications: n/a'}toast(m+n)}
$('bPerm').onclick=perms;$('gOk').onclick=async()=>{await perms();LS.set('rd_gate',1);$('gate').classList.remove('show')};$('gNo').onclick=()=>$('gate').classList.remove('show');
if(!LS.get('rd_gate',0))$('gate').classList.add('show');
