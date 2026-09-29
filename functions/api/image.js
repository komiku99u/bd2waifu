const ALLOWED_HOSTS = new Set(['static.wikitide.net']);

export async function onRequestGet({ request }) {
  const url = new URL(request.url).searchParams.get('url');
  if (!url) return new Response('Missing url', { status: 400 });
  let target;
  try { target = new URL(url); } catch { return new Response('Invalid url', { status: 400 }); }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) return new Response('Host not allowed', { status: 403 });
  const upstream = await fetch(target.toString(), { cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!upstream.ok) return new Response('Image fetch failed', { status: 502 });
  const headers = new Headers(upstream.headers);
  headers.set('access-control-allow-origin','*');
  headers.set('cache-control','public, max-age=86400');
  return new Response(upstream.body, { status: upstream.status, headers });
}
