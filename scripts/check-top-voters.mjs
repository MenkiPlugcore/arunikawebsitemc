import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseTopVotersHtml, topVotersResponse, VOTE_URL} from '../src/top-voters.mjs';

const table=rows=>`<h4>Top voters for this month</h4><table class="table table-bordered"><thead><tr><th width="80%">Nickname</th><th width="20%">Vote(s)</th></tr></thead><tbody>${rows}</tbody></table>`;
const row=(name,votes)=>`<tr><td>${name}</td><td>${votes}</td></tr>`;
const sample=table(row('_BedrockPlayer',3)+row('JavaPlayer',9));
assert.deepEqual(parseTopVotersHtml(sample),[{name:'JavaPlayer',votes:9},{name:'_BedrockPlayer',votes:3}]);
assert.deepEqual(parseTopVotersHtml(table('')),[]);
assert.deepEqual(parseTopVotersHtml(table(row('Player&#95;One',1))),[{name:'Player_One',votes:1}]);
assert.equal(parseTopVotersHtml(table(Array.from({length:20},(_,i)=>row(`Player_${i}`,i+1)).join(''))).length,10);
for(const bad of [
 '<html>Cloudflare challenge</html>',
 sample.replace('Top voters for this month','Top servers'),
 sample.replace('Vote(s)','Balance'),
 table(row('Duplicated',2)+row('DUPLICATED',3)),
 table(row('&lt;script&gt;',2)), table(row('Player','NaN')),
 table(row('Player',-1)), table(row('Player',0)), table(row('Player',2**60)),
 table('<tr><td>Missing count</td></tr>'), table('Unexpected markup'), ' '.repeat(262145)
])assert.throws(()=>parseTopVotersHtml(bad));

const request=new Request('https://example.com/api/top-voters?ignored=1');
const now=Date.now();let fetchCount=0,stored;
const cache={match:async()=>stored?.clone(),put:async(key,value)=>{
 assert.equal(key.url,'https://example.com/api/top-voters');stored=value;
}};
const fetchImpl=async(url,options)=>{
 fetchCount++;assert.equal(url,VOTE_URL);assert.equal(options.method,'GET');
 assert.equal(options.redirect,'error');assert.equal(options.headers.Cookie,undefined);
 return new Response(sample,{headers:{'Content-Type':'text/html; charset=utf-8'}});
};
const first=await topVotersResponse(request,null,{cache,fetchImpl,now:()=>now});
assert.equal(first.status,200);
const data=await first.json();
assert.deepEqual(data.players,[{name:'JavaPlayer',votes:9},{name:'_BedrockPlayer',votes:3}]);
assert.equal(data.fetchedAt,new Date(now).toISOString());
assert.equal(data.period,'current');assert.equal(data.sourceUrl,VOTE_URL);
assert.match(first.headers.get('Cache-Control'),/s-maxage=180/);
assert.equal(first.headers.get('X-Content-Type-Options'),'nosniff');
await topVotersResponse(request,null,{cache,fetchImpl});assert.equal(fetchCount,1,'Cached rankings must avoid another upstream request');
const post=await topVotersResponse(new Request(request,{method:'POST'}),null,{cache,fetchImpl});
assert.equal(post.status,405);assert.equal(post.headers.get('Allow'),'GET');assert.equal(fetchCount,1);
for(const upstream of [
 ()=>new Response('Not Found',{status:404}),
 ()=>new Response('{"secret":"never forward upstream errors"}',{headers:{'Content-Type':'application/json'}}),
 ()=>new Response('Challenge',{headers:{'Content-Type':'text/html'}}),
 ()=>new Response(' '.repeat(262145),{headers:{'Content-Type':'text/html'}}),
 ()=>{throw Error('network failure');}
]){
 const result=await topVotersResponse(request,null,{cache:null,fetchImpl:async()=>upstream()});
 assert.equal(result.status,503);assert.equal(result.headers.get('Cache-Control'),'no-store');
 const failure=await result.json();
 assert.equal(failure.error,'Top voting is temporarily unavailable');
 assert.match(failure.reason,/^source_(unreachable|http_\d{3}|format|data|verification_required)$/);
 assert(!JSON.stringify(failure).includes('never forward upstream errors'));
}
console.log('Passed: monthly voter extraction, genuine empty states, invalid/challenge payloads, names/totals, fixed upstream, bounded response, cache, read-only route, and unavailable-source behavior.');

// Exercise the actual browser controller: rendered data, retries, translations and stale responses.
const dictionariesWindow={};
for(const file of ['translations.js','top-voters-translations.js']){
 vm.runInNewContext(fs.readFileSync(new URL('../dist/'+file,import.meta.url),'utf8'),{window:dictionariesWindow});
}
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.textContent='';this.dataset={};this.attributes={};this.handlers={};this.hidden=false;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=[...nodes];}
 setAttribute(name,value){this.attributes[name]=value;}
 addEventListener(name,handler){this.handlers[name]=handler;}
}
const elements=Object.fromEntries(['home-top-voters','top-voters-list','top-voters-note','top-voters-retry','home'].map(id=>['#'+id,new Element()]));
const document={visibilityState:'visible',handlers:{},querySelector:selector=>elements[selector]??null,createElement:tag=>new Element(tag),addEventListener(name,handler){this.handlers[name]=handler;}};
let language='id',interval,clientCalls=0;
const clientPayload=()=>({source:'Minecraft-MP',period:'current',fetchedAt:new Date().toISOString(),players:[{name:'_BedrockPlayer',votes:3},{name:'JavaPlayer',votes:9}]});
let clientFetch=async()=>new Response(JSON.stringify(clientPayload()));
const window={ARUNIKA_CONFIG:{topVotersEndpoint:'/api/top-voters'},t:key=>dictionariesWindow.ARUNIKA_TRANSLATIONS[language][key]??key,arunikaLocale:()=>language==='id'?'id-ID':language};
const controller=fs.readFileSync(new URL('../dist/top-voters.js',import.meta.url),'utf8');
vm.runInNewContext(controller,{window,document,Intl,URL,Date,AbortSignal,location:{origin:'https://example.com'},fetch:async(url,options)=>{
 clientCalls++;assert.equal(url,'https://example.com/api/top-voters');assert.equal(options.credentials,'omit');return clientFetch();
},setInterval(callback,delay){assert.equal(delay,180000);interval=callback;}});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
await settle();
const list=elements['#top-voters-list'],retry=elements['#top-voters-retry'];
const renderedName=()=>list.children[0].children[1].children[0].children[1].textContent;
assert.equal(renderedName(),'JavaPlayer');assert.equal(list.children.length,2);assert.equal(retry.hidden,true);
assert.equal(elements['#home-top-voters'].attributes['aria-busy'],'false');
for(const code of Object.keys(dictionariesWindow.ARUNIKA_TRANSLATIONS)){
 language=code;window.refreshTopVotersLocale();assert.equal(renderedName(),'JavaPlayer');
 assert(elements['#top-voters-note'].textContent.startsWith(window.t('Sumber: Minecraft-MP')));
}
language='id';
clientFetch=async()=>new Response('Unavailable',{status:503});
await retry.handlers.click();
assert.equal(list.children[0].children[0].textContent,'Top Voting belum tersedia.');assert.equal(retry.hidden,false);
// A retry must work immediately after a failed request, without waiting for the refresh interval.
clientFetch=async()=>new Response(JSON.stringify(clientPayload()));
await retry.handlers.click();assert.equal(renderedName(),'JavaPlayer');assert.equal(retry.hidden,true);
clientFetch=async()=>new Response(JSON.stringify({...clientPayload(),players:[]}));
await retry.handlers.click();assert.equal(list.children[0].children[0].textContent,'Belum ada vote bulan ini.');
clientFetch=async()=>new Response(JSON.stringify({...clientPayload(),fetchedAt:new Date(Date.now()-600000).toISOString()}));
await retry.handlers.click();assert.equal(retry.hidden,false,'Expired data must not render as a current ranking');
clientFetch=async()=>new Response(JSON.stringify({...clientPayload(),players:[{name:'<img src=x onerror=alert(1)>',votes:1}]}));
await retry.handlers.click();assert.equal(renderedName(),'<img src=x onerror=alert(1)>');
assert.equal(list.children[0].children[1].children[0].children[1].children.length,0,'Names must remain text, not HTML');
const beforeHidden=clientCalls;document.visibilityState='hidden';interval();await settle();assert.equal(clientCalls,beforeHidden);
document.visibilityState='visible';elements['#home'].hidden=true;interval();await settle();assert.equal(clientCalls,beforeHidden);
vm.runInNewContext(controller,{document:{querySelector:()=>null}});
console.log('Passed: voter rendering, original player names in 10 locales, empty/error states, immediate retry, stale-data rejection, text-only names, and hidden-page refresh suppression.');
