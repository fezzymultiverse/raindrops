// Edge lighting controls: speed level, thickness, glow, direction, colours
(()=>{const NEON=['#ff2d55','#ff6b00','#ffd60a','#30d158','#00e5ff','#0a84ff','#bf5af2','#ff4fd8','#ffffff'];
const E=Object.assign({sp:5,w:3,gl:6,rv:0,cm:'theme',c1:'#ff2d55',c2:'#00e5ff'},LS.get('rd_edgex',{}));
function go(){const r=document.documentElement.style,t=E.cm=='theme';
r.setProperty('--ec1',t?ACC:E.c1);r.setProperty('--ec2',t?ACC2:E.c2);r.setProperty('--ecf',t?'#fff':E.c1);
r.setProperty('--edur',(9-(E.sp-1)*.9).toFixed(2)+'s');r.setProperty('--ew',E.w+'px');r.setProperty('--eg',E.gl+'px');r.setProperty('--edir',E.rv?'reverse':'normal');
$('esv').textContent='Level '+E.sp;$('ewv').textContent=E.w+'px';$('egv').textContent=E.gl+'px';$('erv').classList.toggle('on',!!E.rv);
$('ecc').classList.toggle('hidden',t);$('ec1i').value=E.c1;$('ec2i').value=E.c2;LS.set('rd_edgex',E)}
[['es','sp'],['ew','w'],['eg','gl']].forEach(([id,k])=>{$(id).value=E[k];$(id).oninput=()=>{E[k]=+$(id).value;go()}});
$('erv').onclick=()=>{E.rv=E.rv?0:1;go()};
chips('ecm',[['theme','Theme colours'],['custom','Custom']],'rd_ecm',E.cm,v=>{E.cm=v;go()});
$('esw').innerHTML=NEON.map(c=>`<div class="chip cs" data-c="${c}" style="background:${c}"></div>`).join('');
$('esw').querySelectorAll('.cs').forEach(s=>s.onclick=()=>{E.c1=s.dataset.c;go()});
$('ec1i').oninput=e=>{E.c1=e.target.value;go()};$('ec2i').oninput=e=>{E.c2=e.target.value;go()};
document.addEventListener('rd-theme',go);go()})();
