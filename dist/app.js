'use strict';
const cfg=window.ARUNIKA_CONFIG||{};
const $=s=>document.querySelector(s);
let statusData=null,statusMode='idle';
function route(){
 let name=location.hash.slice(1)||'home';
 if(!['home','about','store'].includes(name))name='home';
 document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==name);
 document.querySelectorAll('nav a').forEach(a=>{const active=a.hash==='#'+name;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);
$('#year').textContent=new Date().getFullYear();
function element(tag,text){let e=document.createElement(tag);e.textContent=t(text);return e}
function text(selector,source){$(selector).textContent=t(source)}
function modal(title,description){const content=$('#dialog-content');content.replaceChildren(element('h2',title),element('p',description));$('#dialog').showModal();return content}
$('.close').onclick=()=>$('#dialog').close();
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){let r=$('#dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#dialog').close()}});
let toastTimer;
function toast(msg){clearTimeout(toastTimer);$('#toast').textContent=t(msg);$('#toast').style.display='block';toastTimer=setTimeout(()=>$('#toast').style.display='none',3000)}
document.querySelectorAll('[data-join]').forEach(b=>b.onclick=()=>{
 let content=modal('Masuk ke ARUNIKA.','Informasi koneksi resmi server ARUNIKA.');
 if(!cfg.javaAddress&&!cfg.bedrockAddress){content.append(element('p','Alamat Java dan Bedrock belum ditambahkan. Info bergabung akan tersedia setelah pengelola menghubungkan server.'));return}
 for(const [label,address] of [['Java Edition',cfg.javaAddress],['Bedrock Edition',cfg.bedrockAddress?cfg.bedrockAddress+(cfg.bedrockPort?':'+cfg.bedrockPort:''):'']]){
  if(!address)continue;
  let row=element('div','');row.className='join-row';let box=element('div','');let addr=element('strong',address);addr.dir='ltr';box.append(element('small',label),addr);
  let copy=element('button','Salin');copy.onclick=async()=>{try{await navigator.clipboard.writeText(address);toast('Alamat server disalin.')}catch{toast('Pilih alamat server untuk menyalinnya secara manual.')}};
  row.append(box,copy);content.append(row);
 }
});
async function getJSON(url){let endpoint;try{endpoint=new URL(url,location.origin);if(endpoint.protocol!=='https:')throw Error('HTTPS required')}catch{throw Error('Invalid HTTPS endpoint')}let r=await fetch(endpoint.href,{signal:AbortSignal.timeout(10000),cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('Unavailable');return r.json()}
function normalizeServerStatus(d){
 // mcstatus.io returns nested player/version data but does not expose Minecraft TCP ping latency.
 if(!d||typeof d!=='object')throw Error('Invalid status data');
 if(!Number.isFinite(d.retrieved_at))return d; // Keep compatibility with our original backend JSON format.
 const online=d.online===true;
 return {
  online:d.online,
  updatedAt:new Date(d.retrieved_at).toISOString(),
  playersOnline:online&&Number.isFinite(d.players?.online)?d.players.online:null,
  playersMax:online&&Number.isFinite(d.players?.max)?d.players.max:null,
  version:online&&typeof d.version?.name_clean==='string'&&/\b\d+\.\d+(?:\.\d+)?\b/.test(d.version.name_clean)?d.version.name_clean:null,
  latencyMs:null // The public API does not provide an in-game latency metric.
 };
}
function renderStatus(){
 text('#refresh','Perbarui ↻');
 if(statusMode==='idle'){text('#server-state','Belum terhubung');text('#status-sub','Menunggu alamat server');return}
 if(statusMode==='loading'){text('#status-sub','Memeriksa server…');return}
 if(statusMode==='failed'){
  text('#server-state','Status tidak tersedia');text('#status-sub','Koneksi gagal atau data kedaluwarsa');$('.status-orb').className='status-orb';for(let s of ['#online','#version','#latency'])text(s,'—');return;
 }
 let d=statusData;
 text('#server-state',d.online?'Server online':'Server offline');$('.status-orb').className='status-orb '+(d.online?'live':'offline');
 $('#online').textContent=d.online&&Number.isFinite(d.playersOnline)&&Number.isFinite(d.playersMax)?`${new Intl.NumberFormat(arunikaLocale()).format(d.playersOnline)} / ${new Intl.NumberFormat(arunikaLocale()).format(d.playersMax)}`:'—';
 const reportedVersion=d.online&&typeof d.version==='string'&&d.version.trim()?d.version:null;
 const configuredVersion=d.online&&typeof cfg.javaVersion==='string'&&/^\d+\.\d+(?:\.\d+)?$/.test(cfg.javaVersion.trim())?cfg.javaVersion.trim():null;
 $('#version').textContent=reportedVersion||configuredVersion||'—';
 $('#version').title=reportedVersion?'Versi yang dilaporkan langsung oleh Minecraft.':configuredVersion?'Versi dari konfigurasi website; server sedang tidak mengirim nomor versi yang valid.':'Versi server belum tersedia.';
 $('#latency').textContent=d.online&&Number.isFinite(d.latencyMs)?`${new Intl.NumberFormat(arunikaLocale()).format(d.latencyMs)} ms`:'—';
 $('#latency').title=d.latencySource==='api'?'Waktu respons HTTPS dari browser ke API monitoring, bukan ping Minecraft atau latensi pemain.':'Latensi yang dikirim layanan monitoring; bukan ping setiap pemain.';
 $('#status-sub').textContent=t('Diperiksa')+' '+new Date(d.updatedAt).toLocaleTimeString(arunikaLocale());
}
async function updateStatus(){
 if(!cfg.statusEndpoint){toast('Alamat monitor server belum dikonfigurasi.');return}
 $('#refresh').disabled=true;statusMode='loading';renderStatus();
 try{
  const requestStart=performance.now();
  let d=normalizeServerStatus(await getJSON(cfg.statusEndpoint));
  if(!Number.isFinite(d.latencyMs)){
   d.latencyMs=Math.max(0,Math.round(performance.now()-requestStart));
   d.latencySource='api';
  }
  if(typeof d.online!=='boolean'||!d.updatedAt||!Number.isFinite(Date.parse(d.updatedAt))||Math.abs(Date.now()-Date.parse(d.updatedAt))>120000)throw Error('Stale data');
  statusData=d;statusMode='ready';
 }catch{statusData=null;statusMode='failed'}finally{$('#refresh').disabled=false;renderStatus()}
}
$('#refresh').onclick=updateStatus;
window.refreshLocale=()=>{
 renderStatus();window.refreshFeatureSliderLocale?.();window.refreshTopVotersLocale?.();
};
window.refreshLocale();route();
if(cfg.statusEndpoint){updateStatus();setInterval(updateStatus,30000)}
