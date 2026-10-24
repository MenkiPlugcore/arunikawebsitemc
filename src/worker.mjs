import {topVotersResponse} from './top-voters.mjs';

// Same-origin bridge between ARUNIKA website and squaremap's public JSON export.
// No credentials, player IPs, tokens, or private world data are exposed.
const UPSTREAM = 'https://map.cadera.site/leaderboard.json';
const HEADERS = Object.freeze({
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
});
const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {status, headers: HEADERS});

function sanitizeEntries(value) {
  if (!Array.isArray(value) || value.length > 5000) throw Error('Invalid leaderboard');
  return value
    .filter(item => item && typeof item.name === 'string' && item.name.length > 0 &&
      item.name.length <= 40 && typeof item.value === 'number' &&
      Number.isFinite(item.value) && item.value >= 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 100)
    .map(item => ({name:item.name, value:item.value}));
}

export function normalizeLeaderboard(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.updatedAt !== 'string') {
    throw Error('Invalid leaderboard payload');
  }
  const time = Date.parse(raw.updatedAt);
  if (!Number.isFinite(time) || Math.abs(Date.now()-time) > 300000) {
    throw Error('Leaderboard is stale');
  }
  return {
    updatedAt: new Date(time).toISOString(),
    playtime: sanitizeEntries(raw.playtime),
    balance: sanitizeEntries(raw.balance),
    kills: sanitizeEntries(raw.kills)
  };
}

export default {
  async fetch(request, env, ctx) {
    const {pathname} = new URL(request.url);
    if (pathname === '/api/top-voters') return topVotersResponse(request, ctx);
    if (pathname !== '/api/leaderboard') return env.ASSETS.fetch(request);
    if (request.method !== 'GET') return jsonResponse({error:'Method not allowed'}, 405);
    try {
      const upstream = await fetch(UPSTREAM, {
        headers: {'Accept':'application/json'},
        signal: AbortSignal.timeout(7000),
        cf: {cacheTtl: 0}
      });
      if (!upstream.ok) throw Error('squaremap exporter not ready');
      const text = await upstream.text();
      if (text.length > 250000) throw Error('Payload too large');
      return jsonResponse(normalizeLeaderboard(JSON.parse(text)));
    } catch {
      return jsonResponse({error:'Leaderboard data is not yet available'}, 503);
    }
  }
};
