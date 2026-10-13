import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const dist=new URL('../dist/',import.meta.url);
const html=fs.readFileSync(new URL('index.html',dist),'utf8');
const source=fs.readFileSync(new URL('feature-slider.js',dist),'utf8');
const records=[...html.matchAll(/<article[^>]*data-about-feature="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];
assert.equal(records.length,13,'The slider must retain all 13 supplied features');
const names=records.map(([,slug,body])=>({slug,title:body.match(/<h3[^>]*>(.*?)<\/h3>/s)[1]}));
const translationWindow={};
vm.runInNewContext(fs.readFileSync(new URL('translations.js',dist),'utf8'),{window:translationWindow});
const dictionaries=translationWindow.ARUNIKA_TRANSLATIONS;
let language='id';

// A small DOM harness exercises the actual controller, without duplicating its state logic.
const document={documentElement:{lang:'id',dir:'ltr'},activeElement:null};
class Node {
 constructor(){this.children=[];this.attrs=new Map();this.handlers=new Map();this.dataset={};this.selectors={};this.textContent='';this.hidden=false;this.classes=new Set();this.classList={add:name=>this.classes.add(name)};}
 querySelector(selector){return this.selectors[selector]??null;}
 querySelectorAll(selector){return this.lists?.[selector]??[];}
 append(node){this.children.push(node);}
 setAttribute(key,value){this.attrs.set(key,String(value));}
 getAttribute(key){return this.attrs.get(key)??null;}
 removeAttribute(key){this.attrs.delete(key);}
 addEventListener(name,handler){if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(handler);}
 focus(){document.activeElement=this;}
 closest(){return null;}
 setPointerCapture(id){this.captured=id;}
 emit(name,properties={}){
  const event={target:this,preventDefault(){this.defaultPrevented=true;},...properties};
  for(const handler of this.handlers.get(name)??[])handler(event);
  return event;
 }
}
const slider=new Node(),stage=new Node(),controls=new Node(),dots=new Node(),counter=new Node(),announcement=new Node(),previous=new Node(),next=new Node();
controls.hidden=true;
const slides=names.map(({slug,title})=>{
 const slide=new Node(),heading=new Node();slide.id='feature-slide-'+slug;heading.textContent=title;slide.selectors.h3=heading;return slide;
});
stage.lists={'[data-about-feature]':slides};
slider.selectors={'.feature-stage':stage,'.feature-controls':controls,'[data-feature-dots]':dots,'#feature-counter':counter,'[data-feature-announcement]':announcement,'[data-feature-prev]':previous,'[data-feature-next]':next};
document.querySelector=selector=>selector==='#feature-slider'?slider:null;
document.createElement=()=>new Node();
const window={arunikaLocale:()=>language==='id'?'id-ID':language};
const t=key=>dictionaries[language][key]??key;
vm.runInNewContext(source,{document,window,t,Intl,setInterval(){throw Error('The feature gallery must not autoplay');}});

function visible(){const selected=slides.filter(slide=>!slide.hidden);assert.equal(selected.length,1,'Exactly one feature should be visible');return slides.indexOf(selected[0]);}
function key(value,target=stage,extra={}){return slider.emit('keydown',{key:value,target,...extra});}
function swipe(dx,dy=0,type='touch',target=stage){stage.emit('pointerdown',{pointerType:type,pointerId:1,isPrimary:true,button:0,clientX:300,clientY:100,target});stage.emit('pointerup',{pointerId:1,clientX:300+dx,clientY:100+dy});}

assert.equal(visible(),0);assert.equal(counter.textContent,'01 / 13');assert.equal(announcement.textContent,'');
assert.equal(controls.hidden,false);assert(slider.classes.has('is-ready'));
assert.equal(dots.children.length,13);assert.equal(dots.children.filter(dot=>dot.tabIndex===0).length,1);
assert(dots.children[0].getAttribute('aria-label').includes('Player Shop'));
next.emit('click');assert.equal(visible(),1);assert(announcement.textContent.includes('Auction'));
previous.emit('click');assert.equal(visible(),0);
previous.emit('click');assert.equal(visible(),12,'Previous from the first slide wraps to the last');
next.emit('click');assert.equal(visible(),0,'Next from the last slide wraps to the first');
dots.children[10].emit('click');assert.equal(visible(),10);assert.equal(dots.children[10].getAttribute('aria-current'),'true');
assert(dots.children[10].getAttribute('aria-label').includes('5 Senjata Legend'));

key('Home');assert.equal(visible(),0);assert(key('ArrowRight').defaultPrevented);assert.equal(visible(),1);
key('ArrowLeft');assert.equal(visible(),0);key('End');assert.equal(visible(),12);
key('Home');key('ArrowRight',dots.children[0]);assert.equal(visible(),1);assert.equal(document.activeElement,dots.children[1]);
assert.equal(dots.children.filter(dot=>dot.tabIndex===0).length,1);
assert(!key('ArrowRight',stage,{ctrlKey:true}).defaultPrevented);assert.equal(visible(),1);
assert(!key('ArrowDown').defaultPrevented,'Vertical arrow keys retain their normal scrolling behavior');

key('Home');swipe(-100);assert.equal(visible(),1);swipe(100);assert.equal(visible(),0);
swipe(-20);assert.equal(visible(),0,'A tap or small movement must not change slides');
swipe(-80,200);assert.equal(visible(),0,'Vertical page scrolling must not navigate the gallery');
stage.emit('pointerdown',{pointerId:1,isPrimary:true,clientX:300,clientY:100});stage.emit('pointercancel');stage.emit('pointerup',{pointerId:1,clientX:100,clientY:100});assert.equal(visible(),0);
stage.emit('pointerdown',{pointerId:1,isPrimary:true,clientX:300,clientY:100});stage.emit('lostpointercapture');stage.emit('pointerup',{pointerId:1,clientX:100,clientY:100});assert.equal(visible(),0);
stage.emit('pointerdown',{pointerId:1,isPrimary:false,clientX:300,clientY:100});stage.emit('pointerup',{pointerId:1,clientX:100,clientY:100});assert.equal(visible(),0,'A second touch must not navigate during a pinch gesture');
swipe(-100,0,'mouse');assert.equal(visible(),0,'Dragging caption text must not navigate');
const image=new Node();image.closest=selector=>selector==='.feature-media'?stage:null;
swipe(-100,0,'mouse',image);assert.equal(visible(),1,'Dragging an image with the mouse should navigate');

dots.children[10].emit('click');
for(const code of Object.keys(dictionaries)){
 language=code;document.documentElement.lang=code;document.documentElement.dir=code==='ar'?'rtl':'ltr';
 slides.forEach((slide,index)=>{slide.selectors.h3.textContent=dictionaries[code][names[index].title]??names[index].title;});
 window.refreshFeatureSliderLocale();assert.equal(visible(),10,'Changing language must retain the selected feature');
 dots.children.forEach((dot,index)=>{
  const label=dot.getAttribute('aria-label');assert(label.includes(slides[index].selectors.h3.textContent));assert(!/[{}]/.test(label),'Translation placeholders must be resolved');
 });
}
language='ar';document.documentElement.lang='ar';document.documentElement.dir='rtl';
slides.forEach((slide,index)=>{slide.selectors.h3.textContent=dictionaries.ar[names[index].title]??names[index].title;});
window.refreshFeatureSliderLocale();key('Home');key('ArrowRight');assert.equal(visible(),12,'RTL right arrow moves to the previous feature');
key('ArrowLeft');assert.equal(visible(),0);swipe(-100);assert.equal(visible(),12,'RTL swipe direction follows the reading direction');
swipe(100);assert.equal(visible(),0);
assert(!/[{}]/.test(announcement.textContent));
assert(announcement.textContent.includes(dictionaries.ar['Player Shop']??'Player Shop'));

vm.runInNewContext(source,{document:{querySelector:()=>null}});
console.log('Passed: feature slider buttons, wraparound, pagination, keyboard/focus, touch/mouse gestures, vertical-scroll cancellation, 10 locales, and Arabic RTL.');
