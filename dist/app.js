'use strict';
const cfg=window.ARUNIKA_CONFIG||{};
const $=s=>document.querySelector(s);
let category='playtime',board=null,boardFailed=false,statusData=null,statusMode='idle';
const rankNames={playtime:'Waktu bermain',balance:'Saldo',kills:'Kills'};
function route(){
 let name=location.hash.slice(1)||'home';
 if(!['home','about','leaderboard','store','map'].includes(name))name='home';
 document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==name);
 document.querySelectorAll('nav a').forEach(a=>{const active=a.hash==='#'+name;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 window.scrollTo(0,0);if(name==='leaderboard')loadLeaderboard();
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
$('#map-info').onclick=()=>modal('Hubungkan live map.','Pengelola dapat memasang URL HTTPS layanan map pada konfigurasi website. Peta perlu mengizinkan tampil di dalam halaman ini. Penanda pemain mengikuti data dan pengaturan privasi dari layanan map tersebut.');
function https(value){try{let u=new URL(value);return u.protocol==='https:'?u.href:null}catch{return null}}
if(cfg.mapUrl&&https(cfg.mapUrl)){
 const shell=$('#map-shell');let frame=document.createElement('iframe');frame.title='ARUNIKA';frame.src=https(cfg.mapUrl);frame.referrerPolicy='no-referrer';frame.loading='lazy';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups');shell.replaceChildren(frame);
 let note=element('a','Buka peta di tab baru ↗');note.id='map-external';note.href=frame.src;note.target='_blank';note.rel='noopener noreferrer';note.className='button outline';shell.after(note);
}
async function getJSON(url){if(!https(url))throw Error('HTTPS required');let r=await fetch(url,{signal:AbortSignal.timeout(10000),cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('Unavailable');return r.json()}
function normalizeServerStatus(d){
 // mcstatus.io reports Minecraft ping results using a nested player/version schema.
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
 $('#version').textContent=typeof d.version==='string'?d.version:'—';
 $('#latency').textContent=d.online&&Number.isFinite(d.latencyMs)?`${new Intl.NumberFormat(arunikaLocale()).format(d.latencyMs)} ms`:'—';
 $('#status-sub').textContent=t('Diperiksa')+' '+new Date(d.updatedAt).toLocaleTimeString(arunikaLocale());
}
async function updateStatus(){
 if(!cfg.statusEndpoint){toast('Alamat monitor server belum dikonfigurasi.');return}
 $('#refresh').disabled=true;statusMode='loading';renderStatus();
 try{
  let d=normalizeServerStatus(await getJSON(cfg.statusEndpoint));
  if(typeof d.online!=='boolean'||!d.updatedAt||!Number.isFinite(Date.parse(d.updatedAt))||Math.abs(Date.now()-Date.parse(d.updatedAt))>120000)throw Error('Stale data');
  statusData=d;statusMode='ready';
 }catch{statusData=null;statusMode='failed'}finally{$('#refresh').disabled=false;renderStatus()}
}
$('#refresh').onclick=updateStatus;
document.querySelectorAll('[data-rank]').forEach(b=>b.onclick=()=>{category=b.dataset.rank;document.querySelectorAll('[data-rank]').forEach(x=>x.classList.toggle('active',x===b));renderBoard()});
async function loadLeaderboard(){
 if(!cfg.leaderboardEndpoint)return;
 try{let d=await getJSON(cfg.leaderboardEndpoint);if(!d.updatedAt||!Number.isFinite(Date.parse(d.updatedAt))||Math.abs(Date.now()-Date.parse(d.updatedAt))>300000)throw Error('Stale data');board=d;boardFailed=false}
 catch{board=null;boardFailed=true}
 renderBoard();
}
function emptyRow(message){let row=element('tr',''),cell=element('td',message);cell.colSpan=3;cell.style.textAlign='center';row.append(cell);$('#ranking').append(row)}
function renderBoard(){
 text('#rank-heading',rankNames[category]);
 if(boardFailed){$('#ranking').replaceChildren();emptyRow('Leaderboard tidak tersedia. Coba buka halaman ini kembali.');text('#rank-note','Koneksi gagal, data tidak valid, atau pembaruan sudah kedaluwarsa.');return}
 if(!board)return;
 let list=board[category];if(!Array.isArray(list))list=[];
 list=list.filter(x=>typeof x.name==='string'&&typeof x.value==='number'&&Number.isFinite(x.value)).sort((a,b)=>b.value-a.value).slice(0,100);
 $('#ranking').replaceChildren();
 for(let [i,p] of list.entries()){
  let row=element('tr',''),name=document.createElement('td');name.textContent=p.name;name.dir='auto';
  row.append(element('td',new Intl.NumberFormat(arunikaLocale(),{minimumIntegerDigits:2}).format(i+1)),name,element('td',new Intl.NumberFormat(arunikaLocale()).format(p.value)+(category==='playtime'?' '+t('jam'):'')));$('#ranking').append(row);
 }
 if(!list.length)emptyRow('Belum ada data untuk kategori ini.');
 $('#rank-note').textContent=t('Diperbarui')+' '+new Date(board.updatedAt).toLocaleString(arunikaLocale());
}
window.refreshLocale=()=>{
 renderStatus();renderBoard();window.refreshFeatureSliderLocale?.();
 if(cfg.mapUrl&&https(cfg.mapUrl)){text('#map-badge','Map dikonfigurasi');text('#map-external','Buka peta di tab baru ↗')}
};
window.refreshLocale();route();
if(cfg.statusEndpoint){updateStatus();setInterval(updateStatus,30000)}
