// Juice WRLD themes + wallpaper (your own artwork stretched across the app)
(()=>{const wl=$('wall');
function wall(){const img=LS.get('rd_wall_'+theme,null),a=ART[theme],d=LS.get('rd_walld',60)/100;
document.body.classList.toggle('has-wall',!!(img||a));
wl.style.backgroundImage=img?`linear-gradient(rgba(0,0,0,${1-d}),rgba(0,0,0,${1-d})),url(${img})`:(a?a.wall:'');
wl.style.backgroundSize=img?'cover':'auto';wl.classList.toggle('wm',!img&&!!a);$('wd').value=LS.get('rd_walld',60);$('wdv').textContent=Math.round(d*100)+'%'}
document.addEventListener('rd-theme',wall);
document.querySelectorAll('.artt').forEach(c=>c.onclick=()=>{const k=c.dataset.k;setBg(ART[k].bgm);bhSetOutfit(ART[k].outfit);applyTheme(k)});
$('wAdd').onclick=()=>$('fWall').click();
$('fWall').onchange=e=>{const f=e.target.files[0];if(!f)return;const im=new Image();im.onload=()=>{const k=Math.min(1,1100/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);LS.set('rd_wall_'+theme,c.toDataURL('image/jpeg',.85));wall();toast('Wallpaper set')};im.src=URL.createObjectURL(f)};
$('wDel').onclick=()=>{try{localStorage.removeItem('rd_wall_'+theme)}catch(e){}wall();toast('Wallpaper removed')};
$('wd').oninput=()=>{LS.set('rd_walld',+$('wd').value);wall()};
wall()})();
