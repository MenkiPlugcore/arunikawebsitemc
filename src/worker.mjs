import {topVotersResponse} from './top-voters.mjs';

export default {
  async fetch(request, env, ctx) {
    const {pathname} = new URL(request.url);
    if (pathname === '/api/top-voters') return topVotersResponse(request, ctx);
    return env.ASSETS.fetch(request);
  }
};
