const API_KEY = process.env.RIOT_API_KEY;

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1200;

class RiotApi {
  async fetch(url, attempt = 0) {
    if (attempt > 3) throw new Error(`Max retry: ${url}`);

    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
    }
    lastRequestTime = Date.now();

    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${separator}api_key=${API_KEY}`;

    console.log('[REQUEST]:', fullUrl);

    const res = await fetch(fullUrl);

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '2') * 1000;
      console.warn(`[RiotApi] 429 alındı, ${retryAfter}ms bekleniyor...`);
      await new Promise(r => setTimeout(r, retryAfter));
      return this.fetch(url, attempt + 1);
    }

    if (!res.ok) {
      const body = await res.text();
      console.error('[FULL BODY]:', body);
      throw new Error(`Riot API ${res.status}`);
    }

    return res.json();
  }
}

export const riotPool = new RiotApi();