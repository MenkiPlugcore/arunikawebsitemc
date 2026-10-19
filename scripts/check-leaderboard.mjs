import assert from 'node:assert/strict';
import handler,{normalizeLeaderboard} from '../src/worker.mjs';

const now=new Date().toISOString();
const source={
 updatedAt:now,
 playtime:[{name:'_BedrockBob',value:120.5},{name:'JavaAlice',value:48.6}],
 balance:[{name:'JavaAlice',value:13000}],
 kills:[{name:'JavaAlice',value:12}]
};
assert.deepEqual(normalizeLeaderboard(source),source,'Live server leaderboard JSON must be retained');
assert.throws(()=>normalizeLeaderboard({...source, updatedAt:'2000-01-01T00:00:00Z'}),/stale/);
assert.throws(()=>normalizeLeaderboard({...source, playtime:'not an array'}),/Invalid leaderboard/);
assert.equal(normalizeLeaderboard({...source, kills:[{name:'bad',value:Infinity},{name:'ok',value:3}]}).kills.length,1);

const originalFetch=globalThis.fetch;
try {
 globalThis.fetch=async()=>new Response(JSON.stringify(source),{status:200,headers:{'content-type':'application/json'}});
 const fakeAssets={fetch:async()=>new Response('Static page',{status:200})};
 const response=await handler.fetch(new Request('https://example.com/api/leaderboard'),{ASSETS:fakeAssets});
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(await response.json(),source);
 const asset=await handler.fetch(new Request('https://example.com/index.html'),{ASSETS:fakeAssets});
 assert.equal(await asset.text(),'Static page');
 const notAllowed=await handler.fetch(new Request('https://example.com/api/leaderboard',{method:'POST'}),{ASSETS:fakeAssets});
 assert.equal(notAllowed.status,405);
 globalThis.fetch=async()=>new Response('Not Found',{status:404});
 const missing=await handler.fetch(new Request('https://example.com/api/leaderboard'),{ASSETS:fakeAssets});
 assert.equal(missing.status,503,'Missing exporter must not appear as successful data');
} finally {globalThis.fetch=originalFetch;}
console.log('Passed: leaderboard schema, staleness, Java/Bedrock rows, same-origin bridge, static assets and missing exporter.');
