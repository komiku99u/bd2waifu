const ALLOWED_HOSTS = new Set(['static.wikitide.net']);

const WIKI_REFERER = 'https://browndust2wiki.wikitide.org/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0 Safari/537.36';

async function fetchImage(url) {
  const headers = new Headers({
    'User-Agent': USER_AGENT,
    'Referer': WIKI_REFERER,
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  });

  // First try the image URL directly with the same headers a normal browser
  // request from the wiki would carry.
  let response = await fetch(url, {
    headers,
    redirect: 'follow',
    cf: { cacheTtl: 86400, cacheEverything: true }
  });

  // Some Wikitide image endpoints may redirect before applying their image
  // access rules. Retry manually so the Referer is preserved on the redirect.
  if (!response.ok) {
    const manual = await fetch(url, {
      headers,
      redirect: 'manual',
      cf: { cacheTtl: 86400, cacheEverything: true }
    });

    const location = manual.headers.get('location');
    if (location) {
      response = await fetch(new URL(location, url).toString(), {
        headers,
        redirect: 'follow',
        cf: { cacheTtl: 86400, cacheEverything: true }
      });
    } else {
      response = manual;
    }
  }

  return response;
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url).searchParams.get('url');
  if (!url) return new Response('Missing url', { status: 400 });

  let target;
  try {
    target = new URL(url);
  } catch {
    return new Response('Invalid url', { status: 400 });
  }

  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return new Response('Host not allowed', { status: 403 });
  }

  try {
    const upstream = await fetchImage(target.toString());

    if (!upstream.ok) {
      return new Response(`Image fetch failed: ${upstream.status}`, {
        status: 502,
        headers: { 'cache-control': 'no-store' }
      });
    }

    const headers = new Headers(upstream.headers);
    headers.set('access-control-allow-origin', '*');
    headers.set('access-control-allow-methods', 'GET, OPTIONS');
    headers.set('cache-control', 'public, max-age=86400, s-maxage=86400');
    headers.delete('set-cookie');

    return new Response(upstream.body, {
      status: 200,
      headers
    });
  } catch (error) {
    return new Response('Image proxy error', {
      status: 502,
      headers: { 'cache-control': 'no-store' }
    });
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': '*'
    }
  });
}
