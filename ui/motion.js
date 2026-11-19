(function () {
  'use strict';
  const q=s=>document.querySelector(s),reduce=matchMedia('(prefers-reduced-motion: reduce)'),owned=new Set();
  function animate(el,frames,options){if(!el||reduce.matches||!el.animate)return;const a=el.animate(frames,options);owned.add(a);a.finished.catch(()=>{}).finally(()=>owned.delete(a));}
  const ease='cubic-bezier(.22,1,.36,1)';
  function enter(el,delay=0){animate(el,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:480,delay,easing:ease});}
  const glider=document.createElement('i');glider.className='step-glider';glider.setAttribute('aria-hidden','true');q('.work-steps').appendChild(glider);
  function step(){const buttons=Array.from(document.querySelectorAll('.work-steps button')),index=buttons.findIndex(button=>button.classList.contains('on'));glider.hidden=index<0;if(index<0)return;glider.style.width=(100/buttons.length)+'%';glider.style.transform='translateX('+(index*100)+'%)';}
  const reel=q('#galleryReel'),toggle=q('#reelMotion');let want=true,visible=true,ready=false;
  function label(){const playing=!reel.paused;toggle.textContent=reduce.matches?'静态预览':playing?'暂停动态预览':'播放动态预览';toggle.setAttribute('aria-pressed',String(playing));toggle.setAttribute('aria-label',playing?'暂停展厅动态预览':'播放展厅动态预览');toggle.disabled=reduce.matches;}
  function sync(){const allowed=ready&&want&&visible&&!reduce.matches&&!document.hidden&&document.body.dataset.surface==='gallery'&&!q('#sampleDialog').open&&!navigator.connection?.saveData;if(!allowed){reel.pause();label();return;}if(!reel.getAttribute('src'))reel.src='samples/commute/film.mp4';reel.play().then(label).catch(label);}
  reel.muted=true;reel.addEventListener('play',label);reel.addEventListener('pause',label);toggle.addEventListener('click',()=>{want=!want;sync();});
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.05}).observe(q('.feature-wrap'));
  const reveal=new IntersectionObserver(entries=>entries.forEach(e=>{if(!e.isIntersecting)return;enter(e.target,Number(e.target.dataset.enterDelay||0));reveal.unobserve(e.target);}),{threshold:.06});
  document.querySelectorAll('.gallery-copy,.feature-wrap,.gallery-section-head,.case-card').forEach((el,i)=>{el.dataset.enterDelay=String(i<2?i*70:0);reveal.observe(el);});
  const modal=q('#sampleDialog');new MutationObserver(()=>{if(modal.open)animate(modal,[{opacity:0,transform:'translateY(12px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:340,easing:ease});sync();}).observe(modal,{attributes:true,attributeFilter:['open']});
  window.addEventListener('oneshot:navigate',()=>{owned.forEach(a=>a.cancel());owned.clear();const pane=q('.pane.on');animate(pane,[{opacity:.2,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,easing:ease});step();sync();});
  document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',()=>{reel.pause();owned.forEach(a=>a.cancel());});
  reduce.addEventListener('change',()=>{owned.forEach(a=>a.cancel());owned.clear();sync();step();});
  Promise.all([document.fonts.ready,...Array.from(document.querySelectorAll("#pane-gallery img")).map(img=>img.decode().catch(()=>{}))]).then(()=>{ready=true;sync();});
  step();sync();
})();
