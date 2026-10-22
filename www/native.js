// Native Android bridge (Capacitor): notifications, saving + sharing files, background service, battery
const NATIVE=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
const PL=n=>{try{return window.Capacitor.Plugins[n]}catch(e){return null}};
const SYS=()=>PL('RaindropsSys')||PL('Raindrops');
window.notify=async b=>{try{const LN=PL('LocalNotifications');if(!LN)return;await LN.schedule({notifications:[{id:Date.now()%2147483647,title:'Raindrops',body:b}]})}catch(e){}};
window.bgStart=()=>{};window.bgStop=()=>{};window.rdEnsureMic=async()=>true;window.rdEnsurePerms=async()=>({mic:true,notif:true});window.rdOpenSettings=()=>{};
if(NATIVE){
// V1.9.4 runtime permissions: mic (RECORD_AUDIO) and notifications (POST_NOTIFICATIONS, Android 13+) are asked here, before getUserMedia / the Web Audio graph is touched. WAKE_LOCK and FOREGROUND_SERVICE are install-time permissions from the manifest, no prompt exists for them.
const micState=async()=>{try{const P=SYS();if(!P||!P.checkPermissions)return 'unknown';return (await P.checkPermissions()).mic||'unknown'}catch(e){return 'unknown'}};
window.rdEnsureMic=async()=>{const st=await micState();if(st==='granted'||st==='unknown')return true;try{const r=await SYS().requestPermissions({permissions:['mic']});return r.mic==='granted'}catch(e){return false}};
const ensureNotif=async()=>{try{const LN=PL('LocalNotifications');if(!LN)return true;let r=await LN.checkPermissions();if(r.display==='granted')return true;r=await LN.requestPermissions();return r.display==='granted'}catch(e){return true}};
window.rdEnsurePerms=async()=>{const mic=await window.rdEnsureMic(),notif=await ensureNotif();return{mic,notif}};
window.rdOpenSettings=async()=>{try{await SYS().openAppSettings()}catch(e){}};
const ask=async()=>{const r=await window.rdEnsurePerms();if(!r.mic)toast('Microphone blocked: open App settings, Permissions, Microphone, Allow');else if(!r.notif)toast('Notifications blocked: allow them in App settings')};
$('bPerm').addEventListener('click',ask);$('gOk').addEventListener('click',ask);
const b64=b=>new Promise((r,j)=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.onerror=j;f.readAsDataURL(b)});
dl=async(b,n)=>{try{const FS=PL('Filesystem');await FS.writeFile({path:'Raindrops/'+n,data:await b64(b),directory:'DOCUMENTS',recursive:true});toast('Saved: Documents/Raindrops/'+n)}catch(e){toast('Save failed')}};
shareB=async fl=>{try{const FS=PL('Filesystem'),SH=PL('Share');if(!SH){toast('Share not available in this build');return}const uris=[];
for(const [b,n] of fl){const r=await FS.writeFile({path:'share/'+n,data:await b64(b),directory:'CACHE',recursive:true});uris.push(r.uri)}
await SH.share({title:'Raindrops',files:uris})}catch(e){if(!/cancel/i.test(String(e&&e.message||e)))toast('Share failed')}};
window.bgStart=async m=>{try{await SYS().startKeepAlive({mode:m})}catch(e){}};
window.bgStop=async()=>{try{await SYS().stopKeepAlive()}catch(e){}};
const battUI=async()=>{try{const s=await SYS().batteryStatus();$('battS').textContent=s.ignoring?'Battery: unrestricted ✓ (background play allowed)':'Battery: restricted. Tap Allow background, then also check App settings > Battery on your phone.'}catch(e){$('battS').textContent='Background service missing: install the newest raindrops.apk from GitLab CI.'}};
$('bBatt').onclick=async()=>{try{await SYS().requestIgnoreBattery();toast('Choose Allow')}catch(e){toast('Use App settings instead')}};
$('bSet').onclick=async()=>{try{await SYS().openAppSettings()}catch(e){toast('Could not open settings')}};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='visible')battUI()});battUI();
}else{$('bBatt').onclick=$('bSet').onclick=()=>toast('Only in the Android app')}
// V1.9.6 crash report: the native side saves the last crash; it is copied and toasted on the next launch
(async()=>{try{if(!NATIVE)return;const P=SYS();if(!P||!P.lastCrash)return;const r=await P.lastCrash();if(r&&r.log){window.rdLastCrash=r.log;try{navigator.clipboard&&navigator.clipboard.writeText(r.log)}catch(e){}try{toast('Last crash copied to clipboard: '+r.log.split('\n').slice(1,3).join(' ').slice(0,110))}catch(e){}await P.clearCrash()}}catch(e){}})();
