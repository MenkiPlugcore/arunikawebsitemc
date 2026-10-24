'use strict';
(() => {
 const root=document.querySelector('#home-top-voters');
 if(!root)return;
 const list=document.querySelector('#top-voters-list');
 const note=document.querySelector('#top-voters-note');
 const retry=document.querySelector('#top-voters-retry');
 let data=null,mode='loading',busy=false,lastAttempt=0;
 const translate=source=>window.t?.(source)||source;
 const locale=()=>window.arunikaLocale?.()||'id-ID';
 const node=(tag,value,className)=>{const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;};
 function render(){
  list.replaceChildren();
  root.setAttribute('aria-busy',String(mode==='loading'));
  retry.hidden=mode!=='failed';
  retry.disabled=busy;
  retry.textContent=translate('Coba lagi');
  if(mode!=='ready'||!data.players.length){
   const row=document.createElement('tr'),cell=document.createElement('td');
   cell.colSpan=3;cell.className='voters-message';
   cell.textContent=translate(mode==='loading'?'Memuat Top Voting…':mode==='failed'?'Top Voting belum tersedia.':'Belum ada vote bulan ini.');
   row.append(cell);list.append(row);
  }else{
   const number=new Intl.NumberFormat(locale());
   for(const [index,player] of data.players.entries()){
    const row=document.createElement('tr');row.dataset.position=String(index+1);
    const position=document.createElement('td');
    position.append(node('span',number.format(index+1),'voter-position'));
    const playerCell=document.createElement('td'),identity=node('div','','voter-identity');
    const monogram=node('span',Array.from(player.name.replace(/^[_.]+/, '')||player.name).slice(0,2).join('').toUpperCase(),'voter-monogram');
    monogram.setAttribute('aria-hidden','true');
    const name=node('bdi',player.name,'voter-name');name.dir='auto';
    identity.append(monogram,name);playerCell.append(identity);
    const count=node('td',number.format(player.votes),'voter-count');
    row.append(position,playerCell,count);list.append(row);
   }
  }
  note.textContent=translate('Sumber: Minecraft-MP');
  if(mode==='ready')note.textContent+=' · '+translate('Data diperiksa')+' '+new Date(data.fetchedAt).toLocaleString(locale());
 }
 function validate(payload){
  const timestamp=Date.parse(payload?.fetchedAt);
  if(payload?.source!=='Minecraft-MP'||payload.period!=='current'||!Number.isFinite(timestamp)||
    Math.abs(Date.now()-timestamp)>300000||!Array.isArray(payload.players)||payload.players.length>10)throw Error('Invalid voters');
  const seen=new Set();
  for(const player of payload.players){
   if(typeof player?.name!=='string'||!player.name.trim()||player.name.length>40||
      !Number.isSafeInteger(player.votes)||player.votes<=0||seen.has(player.name.toLowerCase()))throw Error('Invalid voter');
   seen.add(player.name.toLowerCase());
  }
  return {...payload,players:[...payload.players].sort((a,b)=>b.votes-a.votes)};
 }
 async function load(){
  if(busy)return;
  busy=true;lastAttempt=Date.now();render();
  try{
   const endpoint=new URL(window.ARUNIKA_CONFIG?.topVotersEndpoint||'/api/top-voters',location.origin);
   if(endpoint.origin!==location.origin)throw Error('Same-origin endpoint required');
   const response=await fetch(endpoint.href,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error('Unavailable');
   data=validate(await response.json());mode='ready';
  }catch{data=null;mode='failed';}
  finally{busy=false;render();}
 }
 retry.addEventListener('click',load);
 window.refreshTopVotersLocale=render;
 render();load();
 setInterval(()=>{if(document.visibilityState!=='hidden'&&!document.querySelector('#home')?.hidden)load();},180000);
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&!document.querySelector('#home')?.hidden&&Date.now()-lastAttempt>=180000)load();
 });
})();
