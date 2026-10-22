// Bobblehead: tribute figure, spring-physics head that bounces to the music/voice
(()=>{const bh=$('bh'),B=Object.assign({on:1,size:110,x:null,y:null,img:null},LS.get('rd_bh',{}));
const hand='M0 0';
bh.innerHTML=`<svg viewBox="0 -14 120 184" xmlns="http://www.w3.org/2000/svg">
<ellipse cx="60" cy="164" rx="34" ry="5" fill="#000" opacity=".5"/>
<rect x="38" y="130" width="17" height="26" rx="6" fill="#1a1a1f"/><rect x="65" y="130" width="17" height="26" rx="6" fill="#1a1a1f"/>
<ellipse cx="46" cy="158" rx="12" ry="6" fill="#eee"/><ellipse cx="74" cy="158" rx="12" ry="6" fill="#eee"/>
<line x1="34" y1="94" x2="26" y2="122" style="stroke:var(--sh,#222)" stroke-width="11" stroke-linecap="round"/><circle cx="26" cy="124" r="6" fill="#8d5a3b"/>
<rect id="bhT" x="30" y="84" width="60" height="50" rx="14" style="fill:var(--sh,#222)"/>
<g class="o o-pne"><text x="60" y="101" text-anchor="middle" font-size="10" font-weight="900" style="fill:var(--accent)" font-family="system-ui">PARTY</text><text x="60" y="113" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" font-family="system-ui">NEVER</text><text x="60" y="125" text-anchor="middle" font-size="10" font-weight="900" style="fill:var(--accent2)" font-family="system-ui">ENDS</text></g>
<g class="o o-n999"><text x="60" y="121" text-anchor="middle" font-size="27" font-weight="900" fill="#fff" font-family="system-ui">999</text></g>
<g class="o o-ggr"><text x="60" y="100" text-anchor="middle" font-size="8.5" font-weight="900" fill="#fff" font-family="system-ui">GOODBYE</text><text x="60" y="111" text-anchor="middle" font-size="8.5" font-weight="900" style="fill:var(--accent)" font-family="system-ui">&amp; GOOD</text><text x="60" y="122" text-anchor="middle" font-size="8.5" font-weight="900" fill="#fff" font-family="system-ui">RIDDANCE</text></g>
<path d="M60 84 l-6 -2 12 -2 -12 -2 12 -2" stroke="#aaa" stroke-width="2" fill="none"/>
<g id="bhH" style="transform-origin:60px 82px">
<ellipse cx="60" cy="46" rx="33" ry="31" fill="#161010"/>
<path d="M33 50 Q27 70 31 92 M38 56 Q34 76 37 96 M87 50 Q93 70 89 92 M82 56 Q86 76 83 96" stroke="#161010" stroke-width="6" stroke-linecap="round" fill="none"/>
<circle cx="33" cy="53" r="5" fill="#8d5a3b"/><circle cx="87" cy="53" r="5" fill="#8d5a3b"/>
<circle cx="60" cy="50" r="27" fill="#8d5a3b"/>
<path d="M32 46 Q33 17 60 17 Q87 17 88 46 Q76 34 60 34 Q44 34 32 46Z" fill="#161010"/>
<circle cx="49" cy="51" r="8.5" fill="#0b0b0b"/><circle cx="71" cy="51" r="8.5" fill="#0b0b0b"/><line x1="57" y1="50" x2="63" y2="50" stroke="#0b0b0b" stroke-width="2.5"/>
<circle cx="46" cy="48" r="2" fill="#fff" opacity=".6"/><circle cx="68" cy="48" r="2" fill="#fff" opacity=".6"/>
<path d="M51 65 Q60 72 69 65" stroke="#2a1208" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<g class="o o-pne"><polygon points="46,22 74,22 60,-10" style="fill:var(--accent)"/><polygon points="52,12 68,12 64,3 56,3" fill="#fff" opacity=".35"/><circle cx="60" cy="-11" r="4" style="fill:var(--accent2)"/></g>
</g>
<line x1="86" y1="94" x2="98" y2="76" style="stroke:var(--sh,#222)" stroke-width="11" stroke-linecap="round"/>
<g transform="translate(98 74)">
<g class="pp p-mic"><rect x="-4.5" y="-26" width="9" height="26" rx="4" fill="#1d1d22"/><rect x="-4.5" y="-18" width="9" height="3" fill="#555"/><circle cy="-31" r="9" fill="#b9b9c2" stroke="#555" stroke-width="1.8"/><path d="M-6 -34 H6 M-7 -31 H7 M-6 -28 H6" stroke="#6a6a74" stroke-width="1"/></g>
<g class="pp p-glow"><rect x="-2.5" y="-34" width="5" height="32" rx="2.5" style="fill:var(--accent)" opacity=".95"/></g>
<g class="pp p-img"><image id="bhI" x="-16" y="-40" width="32" height="40" preserveAspectRatio="xMidYMax meet"/></g>
<circle r="6" fill="#8d5a3b"/></g></svg>`;
const head=$('bhH'),sv=()=>LS.set('rd_bh',B);
const SH={pne:'#140a1c',n999:'#c1121f',ggr:'#1b1b22'};
window.bhOutfit=v=>{bh.dataset.o=v;bh.style.setProperty('--sh',SH[v]||'#222')};
const setO=chips('bho',[['pne','Party Never Ends'],['n999','999'],['ggr','Goodbye & Good Riddance']],'rd_bho','pne',v=>window.bhOutfit(v));window.bhSetOutfit=setO;
chips('bhpc',[['mic','Mic'],['glow','Glow stick'],['img','My image'],['none','Nothing']],'rd_bhp','mic',v=>{bh.dataset.p=v});
function shrink(f,max,cb){const im=new Image();im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);cb(c.toDataURL('image/png'))};im.src=URL.createObjectURL(f)}
window.bhShrink=shrink;
$('pAdd').onclick=()=>$('fProp').click();
$('fProp').onchange=e=>{const f=e.target.files[0];if(f)shrink(f,256,d=>{B.img=d;$('bhI').setAttribute('href',d);sv();bh.dataset.p='img';LS.set('rd_bhp','img');document.querySelectorAll('#bhpc .chip').forEach(c=>c.classList.toggle('on',c.dataset.v=='img'));toast('Prop added')})};
if(B.img)$('bhI').setAttribute('href',B.img);
function lay(){bh.style.setProperty('--bhs',B.size+'px');bh.classList.toggle('hidden',!B.on);$('swBh').classList.toggle('on',!!B.on);$('bsv').textContent=B.size+'px';$('bs').value=B.size;
if(B.x!=null){bh.style.left=Math.min(B.x,innerWidth-40)+'px';bh.style.top=Math.min(B.y,innerHeight-60)+'px';bh.style.right='auto';bh.style.bottom='auto'}sv()}
$('swBh').onclick=()=>{B.on=B.on?0:1;lay()};$('bs').oninput=()=>{B.size=+$('bs').value;lay()};lay();
// drag + bonk
let dr=null;bh.onpointerdown=e=>{const r=bh.getBoundingClientRect();dr={dx:e.clientX-r.left,dy:e.clientY-r.top,sx:e.clientX,sy:e.clientY,m:0};bh.setPointerCapture(e.pointerId)};
bh.onpointermove=e=>{if(!dr)return;if(Math.hypot(e.clientX-dr.sx,e.clientY-dr.sy)>6)dr.m=1;if(dr.m){B.x=e.clientX-dr.dx;B.y=e.clientY-dr.dy;lay()}};
bh.onpointerup=()=>{if(dr&&!dr.m)bump(14);dr=null};
// spring physics
let ang=0,vel=0,by=0,vy=0,last=0,t=0;function bump(a){vel+=a;vy-=Math.abs(a)*.3}
(function fr(){t++;let e=0;if(B.on&&typeof analyser!=='undefined'&&analyser&&td){analyser.getByteTimeDomainData(td);let s=0,n=0;for(let i=0;i<td.length;i+=8){const v=(td[i]-128)/128;s+=v*v;n++}e=Math.sqrt(s/n)}
const k=e-last;if(k>.03&&e>.04)bump((Math.random()<.5?-1:1)*Math.min(k*90,9));last+=(e-last)*.35;
vel+=-ang*.12+Math.sin(t/14)*(e*1.2+.02);vel*=.94;ang=Math.max(-30,Math.min(30,ang+vel));vy+=-by*.2;vy*=.88;by+=vy;
head.style.transform=`translateY(${by.toFixed(2)}px) rotate(${ang.toFixed(2)}deg)`;requestAnimationFrame(fr)})();
})();
