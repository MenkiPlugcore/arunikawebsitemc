'use strict';
(() => {
 const slider=document.querySelector('#feature-slider');
 if(!slider)return;
 const stage=slider.querySelector('.feature-stage');
 const slides=[...stage.querySelectorAll('[data-about-feature]')];
 if(!slides.length)return;
 const controls=slider.querySelector('.feature-controls');
 const dotGroup=slider.querySelector('[data-feature-dots]');
 const counter=slider.querySelector('#feature-counter');
 const announcement=slider.querySelector('[data-feature-announcement]');
 let active=0,gesture=null;
 const rtl=()=>document.documentElement.dir==='rtl';
 const format=(source,values)=>t(source).replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
 const dots=slides.map((slide,index)=>{
  const button=document.createElement('button');
  button.type='button';button.className='feature-dot';button.dataset.featureDot=String(index);
  button.setAttribute('aria-controls',slide.id);
  const marker=document.createElement('span');marker.setAttribute('aria-hidden','true');button.append(marker);
  button.addEventListener('click',()=>show(index));dotGroup.append(button);return button;
 });
 function refreshLabels(announce=false){
  const locale=window.arunikaLocale?.()||document.documentElement.lang||'id';
  const numbers=new Intl.NumberFormat(locale);
  const padded=new Intl.NumberFormat(locale,{minimumIntegerDigits:2});
  counter.textContent=padded.format(active+1)+' / '+padded.format(slides.length);
  dots.forEach((button,index)=>{
   button.setAttribute('aria-label',format('Tampilkan fitur {number}: {name}',{
    number:numbers.format(index+1),name:slides[index].querySelector('h3').textContent.trim()
   }));
   if(index===active)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');
   button.tabIndex=index===active?0:-1;
  });
  announcement.textContent=announce?format('Fitur {current} dari {total}: {name}',{
   current:numbers.format(active+1),total:numbers.format(slides.length),name:slides[active].querySelector('h3').textContent.trim()
  }):'';
 }
 function show(index){
  active=((index%slides.length)+slides.length)%slides.length;
  slides.forEach((slide,position)=>{slide.hidden=position!==active;});
  refreshLabels(true);
 }
 slider.querySelector('[data-feature-prev]').addEventListener('click',()=>show(active-1));
 slider.querySelector('[data-feature-next]').addEventListener('click',()=>show(active+1));
 slider.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  let next;
  if(event.key==='ArrowRight')next=active+(rtl()?-1:1);
  else if(event.key==='ArrowLeft')next=active+(rtl()?1:-1);
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=slides.length-1;
  else return;
  event.preventDefault();show(next);
  if(event.target.dataset.featureDot!==undefined)dots[active].focus({preventScroll:true});
 });
 stage.addEventListener('pointerdown',event=>{
  if(event.isPrimary===false)return;
  if(event.pointerType==='mouse'&&(event.button!==0||!event.target.closest('.feature-media')))return;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY};
  stage.setPointerCapture?.(event.pointerId);
 });
 stage.addEventListener('pointerup',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;gesture=null;
  if(Math.abs(dx)<50||Math.abs(dx)<Math.abs(dy)*1.2)return;
  show(active+(dx<0?1:-1)*(rtl()?-1:1));
 });
 stage.addEventListener('pointercancel',()=>{gesture=null;});
 stage.addEventListener('lostpointercapture',()=>{gesture=null;});
 window.refreshFeatureSliderLocale=()=>refreshLabels();
 show(0);announcement.textContent='';
 controls.hidden=false;slider.classList.add('is-ready');
})();
