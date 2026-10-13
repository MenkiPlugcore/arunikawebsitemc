import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname;
const dist=path.join(root,'dist');
for(const name of ['app.js','config.js','i18n.js','translations.js'])execFileSync(process.execPath,['--check',path.join(dist,name)]);
const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');
for(const [,hash] of html.matchAll(/href="#([^"]+)"/g))assert(ids.includes(hash),`Unknown section ${hash}`);
for(const [,ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g))if(!/^https?:/.test(ref))assert(fs.existsSync(path.join(dist,ref)),`Missing asset ${ref}`);
for(const name of fs.readdirSync(dist))if(/\.(html|css|js)$/.test(name))assert(!/cadera/i.test(fs.readFileSync(path.join(dist,name),'utf8')),`Old branding in ${name}`);
const window={};vm.runInNewContext(fs.readFileSync(path.join(dist,'translations.js'),'utf8'),{window});
const data=window.ARUNIKA_TRANSLATIONS,codes=['id','en','ja','es','ar','th','vi','ms','ko','zh-TW'];
assert.deepEqual(Object.keys(data),codes);const keys=Object.keys(data.id);
for(const code of codes){assert.deepEqual(Object.keys(data[code]),keys);assert(keys.every(k=>typeof data[code][k]==='string'&&data[code][k].trim()));new Intl.NumberFormat(code).format(1234);}
for(const saved of [...codes,'invalid']){
 let handler,options=[],writes={},refreshCount=0;
 const node={textContent:'Beranda',isConnected:true,parentElement:{tagName:'A'}};
 const select={append:x=>options.push(x),setAttribute(){},addEventListener:(_,cb)=>handler=cb};
 const meta={content:''};
 const document={body:{},documentElement:{},createTreeWalker(){let done=false;return {nextNode(){if(done)return false;done=true;this.currentNode=node;return true}}},querySelector:s=>s==='#language-select'?select:meta,querySelectorAll:()=>[],createElement:()=>({})};
 const w={ARUNIKA_TRANSLATIONS:data,refreshLocale:()=>refreshCount++};
 const context={window:w,document,NodeFilter:{SHOW_TEXT:4},localStorage:{getItem:()=>saved,setItem:(k,v)=>writes[k]=v}};
 Object.defineProperty(context,'t',{get:()=>w.t});vm.runInNewContext(fs.readFileSync(path.join(dist,'i18n.js'),'utf8'),context);
 assert.equal(options.length,10);assert.equal(document.documentElement.lang,saved==='invalid'?'id':saved);
 for(const code of codes){select.value=code;handler();assert.equal(node.textContent,data[code].Beranda);assert.equal(document.documentElement.lang,code);assert.equal(document.documentElement.dir,code==='ar'?'rtl':'ltr');assert.equal(writes['arunika-language'],code);assert.equal(w.t('Unknown player name'),'Unknown player name');}
 assert(refreshCount>10);
}
assert(fs.existsSync(path.join(dist,'assets/arunika-hero.png')));
const workerConfig=fs.readFileSync(path.join(root,'wrangler.toml'),'utf8');
assert(!workerConfig.includes('pages_build_output_dir'),'Workers config must not use the Pages output key');
assert.match(workerConfig,/\[assets\][\s\S]*directory\s*=\s*"\.\/dist"/,'Workers must serve dist as static assets');
assert.equal(fs.readFileSync(path.join(root,'wrangler.pages.toml'),'utf8').match(/pages_build_output_dir\s*=\s*"([^"]+)"/)[1],'./dist');

const productCards=[...html.matchAll(/<a class="rank-card"([^>]+)>/g)].map(([,attrs])=>Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,name,value])=>[name,value])));
const expectedProducts=[['dawn',15000],['sunflare',35000],['meadow',65000],['horizon',120000],['aurora',150000],['zenith',300000]];
assert.equal(productCards.length,expectedProducts.length,'Six supplied rank cards must be visible');
productCards.forEach((card,index)=>{
 const [rank,amount]=expectedProducts[index];assert.equal(card['data-store-rank'],rank,'Ranks must appear cheapest first');assert.equal(Number(card['data-price']),amount,'Rank price must match source card');
 const url=new URL(card.href);assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/6285703163488','Order must use the supplied WhatsApp number');
 const message=url.searchParams.get('text');const rankName=rank.charAt(0).toUpperCase()+rank.slice(1);
 assert(message.includes(rankName)&&message.includes('ARUNIKA')&&message.includes('Rp'+amount.toLocaleString('id-ID')),'Each order must identify its rank and price');assert(message.includes('Nickname Minecraft:'));
 assert.equal(card.target,'_blank');assert(card.rel.includes('noopener'));assert(card.rel.includes('noreferrer'));
});

console.log('Passed: syntax, assets, routes, ARUNIKA branding, 10 languages, persistence, fallback, Arabic RTL, Workers assets, Pages output, rank order/prices/WhatsApp links.');
