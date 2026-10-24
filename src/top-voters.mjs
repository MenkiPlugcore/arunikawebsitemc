// Read-only monthly rankings published by ARUNIKA's Minecraft-MP listing.
// No vote submissions, reward claims, credentials, or player IPs are involved.
export const VOTE_URL = 'https://minecraft-mp.com/server/365453/vote/';
const MAX_HTML_BYTES = 262144;
const CACHE_SECONDS = 180;

function plainText(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
    const named = {amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' '};
    if (entity[0] !== '#') return named[entity.toLowerCase()];
    const value = /^#x/i.test(entity) ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
      ? String.fromCodePoint(value) : '\ufffd';
  }).trim();
}

export function parseTopVotersHtml(html) {
  if (typeof html !== 'string' || new TextEncoder().encode(html).length > MAX_HTML_BYTES) {
    throw Error('Invalid voter page size');
  }
  const heading = /<h4\b[^>]*>\s*Top voters for this month\s*<\/h4>/i.exec(html);
  if (!heading) throw Error('Monthly voter section is missing');
  const section = html.slice(heading.index + heading[0].length, heading.index + heading[0].length + 65536);
  const table = /^\s*<table\b[^>]*>([\s\S]*?)<\/table>/i.exec(section)?.[1];
  if (!table || !/<th\b[^>]*>\s*Nickname\s*<\/th>/i.test(table) ||
      !/<th\b[^>]*>\s*Vote\(s\)\s*<\/th>/i.test(table)) throw Error('Unexpected voter table');
  const body = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(table)?.[1];
  if (body === undefined) throw Error('Missing voter rows');
  const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  if (rows.length > 500) throw Error('Too many voter rows');
  const players = [], seen = new Set();
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => plainText(cell[1]));
    if (cells.length !== 2) throw Error('Unexpected voter row');
    const [name, count] = cells;
    if (!name || name.length > 40 || /[<>\u0000-\u001f\u007f]/.test(name) || !/^\d+$/.test(count)) {
      throw Error('Invalid voter entry');
    }
    const votes = Number(count), identity = name.toLowerCase();
    if (!Number.isSafeInteger(votes) || votes <= 0 || seen.has(identity)) throw Error('Invalid voter totals');
    seen.add(identity);
    players.push({name, votes});
  }
  // A non-empty malformed body must not look like a genuine empty month.
  if (!rows.length && body.trim()) throw Error('Unrecognized empty voter table');
  return players.sort((a, b) => b.votes - a.votes).slice(0, 10);
}

async function limitedHtml(response) {
  const reader = response.body?.getReader();
  if (!reader) throw Error('Missing upstream body');
  const decoder = new TextDecoder();
  let bytes = 0, result = '';
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_HTML_BYTES) throw Error('Voter page too large');
      result += decoder.decode(value, {stream:true});
    }
    return result + decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

const responseHeaders = {
  'Content-Type':'application/json; charset=utf-8',
  'X-Content-Type-Options':'nosniff'
};

export async function topVotersResponse(request, ctx, options = {}) {
  if (request.method !== 'GET') return new Response(JSON.stringify({error:'Method not allowed'}), {
    status:405, headers:{...responseHeaders, 'Cache-Control':'no-store', Allow:'GET'}
  });
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const cache = options.cache === undefined ? globalThis.caches?.default : options.cache;
  const cacheKey = new Request(new URL('/api/top-voters', request.url));
  if (cache) {
    try { const cached = await cache.match(cacheKey); if (cached) return cached; } catch { /* Fetch without edge cache. */ }
  }
  let reason = 'source_unreachable';
  try {
    const upstream = await fetchImpl(VOTE_URL, {
      method:'GET', headers:{Accept:'text/html', 'User-Agent':'ARUNIKA-Website/1.0'},
      redirect:'error', signal:AbortSignal.timeout(7000)
    });
    const html = await limitedHtml(upstream);
    if (/<title>\s*Just a moment|checking your browser|verify you are human|id=["']challenge-form/i.test(html)) {
      reason = 'source_verification_required';
      throw Error('Voter source requires verification');
    }
    reason = `source_http_${upstream.status}`;
    if (!upstream.ok) throw Error('Voter source unavailable');
    reason = 'source_format';
    if (!/text\/html/i.test(upstream.headers.get('Content-Type') || '')) throw Error('Unexpected voter format');
    reason = 'source_data';
    const players = parseTopVotersHtml(html);
    const result = new Response(JSON.stringify({
      source:'Minecraft-MP', sourceUrl:VOTE_URL, period:'current',
      fetchedAt:new Date(options.now?.() ?? Date.now()).toISOString(), players
    }), {headers:{...responseHeaders, 'Cache-Control':`public, max-age=60, s-maxage=${CACHE_SECONDS}`}});
    if (cache) {
      const write = cache.put(cacheKey, result.clone()).catch(() => {});
      if (ctx?.waitUntil) ctx.waitUntil(write); else await write;
    }
    return result;
  } catch {
    return new Response(JSON.stringify({error:'Top voting is temporarily unavailable', reason}), {
      status:503, headers:{...responseHeaders, 'Cache-Control':'no-store', 'Retry-After':'60'}
    });
  }
}
