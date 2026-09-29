export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json([], { headers: corsHeaders() });
  const result = await env.DB.prepare(`SELECT waifu_id, vote_count FROM waifu_votes ORDER BY vote_count DESC, waifu_id ASC LIMIT 12`).all();
  return Response.json(result.results || [], { headers: corsHeaders() });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'D1 is not configured' }, { status: 503, headers: corsHeaders() });
  let body;
  try { body = await request.json(); } catch { return Response.json({error:'Invalid JSON'}, {status:400,headers:corsHeaders()}); }
  const ids = Array.isArray(body.waifuIds) ? [...new Set(body.waifuIds.map(String))].slice(0,9) : [];
  if (ids.length !== 9) return Response.json({error:'Exactly 9 waifu IDs are required'}, {status:400,headers:corsHeaders()});
  const statements = ids.map(id => env.DB.prepare(`INSERT INTO waifu_votes (waifu_id, vote_count) VALUES (?, 1) ON CONFLICT(waifu_id) DO UPDATE SET vote_count = vote_count + 1`).bind(id));
  await env.DB.batch(statements);
  return Response.json({ok:true}, {headers:corsHeaders()});
}

function corsHeaders(){return {'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','cache-control':'no-store'}}
