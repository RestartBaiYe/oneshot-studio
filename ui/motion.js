(function () {
  'use strict';
  var q=function(s){return document.querySelector(s);};
  var reduce=matchMedia('(prefers-reduced-motion: reduce)'),owned=new Set();
  function animate(el,frames,options){if(!el||reduce.matches||!el.animate)return;var a=el.animate(frames,options);owned.add(a);a.finished.catch(function(){}).finally(function(){owned.delete(a);});}
  var ease='cubic-bezier(.22,1,.36,1)',nav=q('.work-steps'),step=function(){};
  if(nav){var glider=document.createElement('i');glider.className='step-glider';glider.setAttribute('aria-hidden','true');nav.appendChild(glider);step=function(){var buttons=Array.from(nav.querySelectorAll('button')),index=buttons.findIndex(function(b){return b.classList.contains('on');});glider.hidden=index<0;if(index>=0){glider.style.width=(100/buttons.length)+'%';glider.style.transform='translateX('+(index*100)+'%)';}};step();}
  var preview=q('.home-preview');if(preview){preview.addEventListener('pointermove',function(e){if(reduce.matches||e.pointerType!=='mouse')return;var box=preview.getBoundingClientRect();preview.style.setProperty('--px',((e.clientX-box.left)/box.width*100)+'%');preview.style.setProperty('--py',((e.clientY-box.top)/box.height*100)+'%');});preview.addEventListener('pointerleave',function(){preview.style.removeProperty('--px');preview.style.removeProperty('--py');});}
  var revealItems=document.querySelectorAll('.home-copy,.home-preview,.path-card,.gallery-examples>header,.case-card');
  if('IntersectionObserver' in window){var reveal=new IntersectionObserver(function(entries){entries.forEach(function(e){if(!e.isIntersecting)return;animate(e.target,[{opacity:0,transform:'translateY(13px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,delay:Math.min(Number(e.target.dataset.enterDelay||0),140),easing:ease});reveal.unobserve(e.target);});},{threshold:.04});Array.prototype.forEach.call(revealItems,function(el,i){el.dataset.enterDelay=String(i%4*45);reveal.observe(el);});}
  var modal=q('#sampleDialog');if(modal&&'MutationObserver' in window)new MutationObserver(function(){if(modal.open)animate(modal,[{opacity:0,transform:'translateY(12px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:300,easing:ease});}).observe(modal,{attributes:true,attributeFilter:['open']});
  window.addEventListener('oneshot:navigate',function(){owned.forEach(function(a){a.cancel();});owned.clear();var pane=q('.pane.on');animate(pane,[{opacity:.3,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:ease});if(nav)step();});
  reduce.addEventListener('change',function(){owned.forEach(function(a){a.cancel();});owned.clear();if(nav)step();});
  document.addEventListener('pointerdown',function(e){var b=e.target.closest('button');if(!b||b.disabled||reduce.matches)return;animate(b,[{transform:'scale(1)'},{transform:'scale(.97)'},{transform:'scale(1)'}],{duration:230,easing:ease});});
})();
