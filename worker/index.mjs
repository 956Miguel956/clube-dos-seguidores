/* =============================================================
   CLUBE DOS SEGUIDORES — servidor na Cloudflare (Worker + banco D1)
   - Entrega o site (pasta public/)
   - /api/state ............ mapa público (jogadores, fila, titulares)
   - /api/admin ............ painel do criador (senha)
   - /api/instagram-webhook  comentários em tempo real (opcional)
   - /api/status ........... diagnóstico da conexão com o Instagram
   - a cada 1 min .......... lê os comentários dos vídeos do jogo e responde
   ============================================================= */
import '../public/times.js';
import '../public/core.js';
const G = globalThis.GameCore;
const TABLE = 'clube_kv'; // tabela própria: pode usar o mesmo banco D1 do Tenha Sua Empresa
const DEFAULT_CFG = { gameTag: '#clubedosseguidores', autoReply: true };

const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });
const raw = (txt, status = 200, extra = {}) => new Response(txt, { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra } });

/* ---------------- banco de dados (D1) ---------------- */
let ready = false;
async function init(env) {
  if (ready) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ${TABLE} (k TEXT PRIMARY KEY, v TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 0)`).run();
  ready = true;
}
async function getRow(env, k) { await init(env); return env.DB.prepare(`SELECT v, rev FROM ${TABLE} WHERE k = ?`).bind(k).first(); }
async function getKV(env, k, def) { const r = await getRow(env, k); if (!r) return def; try { return JSON.parse(r.v); } catch (e) { return def; } }
async function setKV(env, k, val) { await init(env); await env.DB.prepare(`INSERT INTO ${TABLE} (k, v, rev) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET v = excluded.v, rev = ${TABLE}.rev + 1`).bind(k, JSON.stringify(val)).run(); }
const getCfg = async env => Object.assign({}, DEFAULT_CFG, await getKV(env, 'cfg', {}));

// carrega o mapa -> aplica a mudança -> salva (tenta de novo se outra execução salvou no meio)
async function mutate(env, fn) {
  for (let i = 0; i < 6; i++) {
    const row = await getRow(env, 'state');
    let S; try { S = row ? JSON.parse(row.v) : G.newState(); } catch (e) { S = G.newState(); }
    const mem = G.decode(S);
    const res = await fn(mem);
    const txt = JSON.stringify(G.encode(mem));
    let ok;
    if (!row) ok = (await env.DB.prepare(`INSERT OR IGNORE INTO ${TABLE} (k, v, rev) VALUES ('state', ?, 1)`).bind(txt).run()).meta.changes > 0;
    else ok = (await env.DB.prepare(`UPDATE ${TABLE} SET v = ?, rev = rev + 1 WHERE k = 'state' AND rev = ?`).bind(txt, row.rev).run()).meta.changes > 0;
    if (ok) return { res, txt, rev: row ? row.rev + 1 : 1 };
    await new Promise(r => setTimeout(r, 100 + Math.random() * 250));
  }
  throw new Error('Não consegui salvar (muitas alterações ao mesmo tempo). Tente de novo.');
}
const statePayload = (txt, rev) => `{"rev":${rev},"s":${txt}}`;

/* ---------------- Instagram ---------------- */
const API = env => (env.IG_API_BASE || 'https://graph.instagram.com/v21.0').replace(/\/$/, '');
const igGetStatus = env => getKV(env, 'ig-status', {});
const igSetStatus = (env, s) => setKV(env, 'ig-status', s);
async function getJSON(url) {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
  return j;
}
async function igPost(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
  return j;
}
async function sha(txt) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
// senha do painel: variável ADMIN_KEY da Cloudflare ou senha criada no próprio painel (guardada com hash no banco)
async function adminInfo(env) { return env.ADMIN_KEY ? { env: true } : await getKV(env, 'admin', null); }
async function checkKey(env, key) {
  if (!key) return false;
  if (env.ADMIN_KEY) return key === env.ADMIN_KEY;
  const a = await getKV(env, 'admin', null);
  return !!a && a.hash === await sha(a.salt + '|' + key);
}
const manualToken = async env => ((await getKV(env, 'ig-token-manual', null)) || {}).token || '';
// usa o token (variável IG_TOKEN ou colado no painel) e renova sozinho a cada 7 dias
async function igToken(env) {
  const tokEnv = (env.IG_TOKEN || '').trim() || (await manualToken(env)).trim();
  if (!tokEnv) return null;
  const tag = tokEnv.slice(-12);
  const saved = await getKV(env, 'ig-token', null);
  let tok = saved && saved.from === tag ? saved.token : tokEnv;
  const last = saved && saved.from === tag ? saved.at : 0;
  if (Date.now() - last > 7 * 864e5) {
    try { const j = await getJSON(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(tok)}`); if (j.access_token) tok = j.access_token; } catch (e) {}
    await setKV(env, 'ig-token', { token: tok, from: tag, at: Date.now() });
  }
  return tok;
}
async function igCheck(env) {
  const st = await igGetStatus(env);
  const tok = await igToken(env);
  if (!tok) { st.error = 'Token do Instagram ainda não foi colocado (Painel → Instagram).'; await igSetStatus(env, st); return st; }
  try { const me = await getJSON(`${API(env)}/${env.IG_USER_ID || 'me'}?fields=id,username&access_token=${encodeURIComponent(tok)}`); st.username = me.username; st.userId = me.id; st.error = null; st.checked = Date.now(); }
  catch (e) { st.error = e.message; }
  await igSetStatus(env, st); return st;
}
const siteUrl = (env, st) => env.SITE_URL || (st && st.site) || '';
// 1 resposta por pessoa para cada situação; só em comentários principais
async function sendReplies(env, cfg, items, tok, st) {
  if (!cfg.autoReply || !tok || !items.length) return 0;
  const rep = await getKV(env, 'replied', {});
  let sent = 0;
  for (const it of items) {
    if (sent >= 25) break;
    if (!it.r || it.ev.parent || !it.ev.commentId) continue;
    const msg = G.replyText(it.r, siteUrl(env, st));
    if (!msg) continue;
    const key = it.r.user + '|' + (it.r.kind === 'ok' || it.r.kind === 'fila' ? 'entrou' : it.r.kind);
    if (rep[key]) continue;
    try { await igPost(`${API(env)}/${it.ev.commentId}/replies`, { message: msg, access_token: tok }); rep[key] = Date.now(); sent++; }
    catch (e) { st.replyError = e.message; }
  }
  const ks = Object.keys(rep); if (ks.length > 30000) for (const k of ks.sort((a, b) => rep[a] - rep[b]).slice(0, ks.length - 25000)) delete rep[k];
  if (sent) await setKV(env, 'replied', rep);
  st.replies = (st.replies || 0) + sent; if (sent) st.lastReply = Date.now();
  return sent;
}
async function applyEvents(env, evs) {
  let out = [];
  if (!evs.length) return { out };
  await mutate(env, mem => { out = []; for (const e of evs) { const r = G.processComment(mem, e); if (r) out.push({ ev: e, r }); } });
  // guarda os ids dos comentários já contados
  const seen = await getKV(env, 'seen', {});
  for (const e of evs) if (e.commentId) seen[String(e.commentId)] = Date.now();
  const ks = Object.keys(seen); if (ks.length > 40000) { ks.sort((a, b) => seen[a] - seen[b]); for (const k of ks.slice(0, ks.length - 30000)) delete seen[k]; }
  await setKV(env, 'seen', seen);
  return { out };
}
const userOf = c => (c.from && c.from.username) || c.username;
async function pollInstagram(env) {
  const st = await igGetStatus(env);
  const tok = await igToken(env);
  if (!tok) return { skipped: 'sem token' };
  const cfg = await getCfg(env);
  const enc = encodeURIComponent(tok), uid = env.IG_USER_ID || 'me';
  const seen = await getKV(env, 'seen', {});
  const evs = [];
  try {
    if (!st.username) { const me = await getJSON(`${API(env)}/${uid}?fields=id,username&access_token=${enc}`); st.username = me.username; st.userId = me.id; }
    const media = await getJSON(`${API(env)}/${uid}/media?fields=id,timestamp,caption&limit=15&access_token=${enc}`);
    const game = (media.data || []).filter(m => G.isGameCaption(cfg, m.caption)).slice(0, +env.IG_POSTS || 3);
    st.gamePosts = game.length;
    st.captions = (media.data || []).slice(0, 6).map(m => ({ id: m.id, data: m.timestamp, legenda: (m.caption || '').slice(0, 90), contaNoJogo: G.isGameCaption(cfg, m.caption) }));
    for (const m of game) {
      let url = `${API(env)}/${m.id}/comments?fields=id,text,username,from,timestamp&limit=50&access_token=${enc}`;
      for (let pg = 0; url && pg < 10; pg++) {
        const j = await getJSON(url);
        for (const c of j.data || []) evs.push({ user: userOf(c), text: c.text, mediaId: m.id, commentId: c.id, ts: Date.parse(c.timestamp) || 0 });
        url = j.paging && j.paging.next;
      }
    }
    st.error = null;
  } catch (e) { st.error = e.message; }
  st.comentariosLidos = evs.length;
  const own = (st.username || '').toLowerCase();
  const why = { semUsuario: 0, doDono: 0, jaContado: 0, ok: 0 };
  const novos = evs.filter(e => {
    if (!e.user) { why.semUsuario++; return false; }
    if (e.user.toLowerCase() === own) { why.doDono++; return false; }
    if (seen[String(e.commentId)]) { why.jaContado++; return false; }
    why.ok++; return true;
  }).sort((a, b) => a.ts - b.ts);
  st.filtro = why;
  for (const e of novos) e.ownUser = own;
  const { out } = await applyEvents(env, novos);
  await sendReplies(env, cfg, out, tok, st);
  st.lastPoll = Date.now(); st.imported = (st.imported || 0) + out.filter(x => x.r.kind === 'ok' || x.r.kind === 'fila').length;
  await igSetStatus(env, st);
  return { novos: out.length, erro: st.error };
}
async function mediaIsGame(env, cfg, mediaId, tok) {
  if (!String(cfg.gameTag || '').trim()) return true;
  if (!mediaId || !tok) return false;
  const cache = await getKV(env, 'media-cache', {});
  if (mediaId in cache) return cache[mediaId];
  let ok = false;
  try { const m = await getJSON(`${API(env)}/${mediaId}?fields=caption&access_token=${encodeURIComponent(tok)}`); ok = G.isGameCaption(cfg, m.caption); } catch (e) { return false; }
  cache[mediaId] = ok; await setKV(env, 'media-cache', cache);
  return ok;
}
async function processWebhook(env, payload) {
  const st = await igGetStatus(env);
  const own = (st.username || env.IG_USERNAME || '').toLowerCase();
  const tok = await igToken(env);
  const cfg = await getCfg(env);
  const seen = await getKV(env, 'seen', {});
  const evs = [];
  for (const en of payload.entry || []) for (const ch of en.changes || []) {
    if (ch.field !== 'comments' && ch.field !== 'live_comments') continue;
    const v = ch.value || {};
    const u = v.from && v.from.username, mid = v.media && v.media.id;
    if (!u || u.toLowerCase() === own || seen[String(v.id)]) continue;
    if (!(await mediaIsGame(env, cfg, mid, tok))) continue;
    evs.push({ user: u, text: v.text || '', mediaId: mid, commentId: v.id, parent: v.parent_id || null, ownUser: own });
  }
  if (!evs.length) return 0;
  const { out } = await applyEvents(env, evs);
  await sendReplies(env, cfg, out, tok, st);
  st.lastWebhook = Date.now(); st.imported = (st.imported || 0) + out.filter(x => x.r.kind === 'ok' || x.r.kind === 'fila').length; await igSetStatus(env, st);
  return out.length;
}
async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------------- painel ---------------- */
async function adminAction(env, a) {
  const C = G.clubs();
  const ciOf = v => { const n = +v; return Number.isInteger(n) && C[n] ? n : null; };
  switch (a.action) {
    case 'test': { // comentário de teste: mesma regra do Instagram, sem resposta automática
      const r = await mutate(env, mem => G.processComment(mem, { user: a.user, text: a.text }));
      return r;
    }
    case 'add': {
      const h = G.cleanH(a.user), ci = ciOf(a.ci);
      if (!G.validH(h) || ci === null) throw new Error('@ ou time inválido');
      return mutate(env, mem => G.join(mem, h, ci, false));
    }
    case 'remove': {
      const h = G.cleanH(a.user);
      return mutate(env, mem => G.remove(mem, h) || { st: 'nao' });
    }
    case 'sortear': {
      const ci = ciOf(a.ci); if (ci === null) throw new Error('time inválido');
      return mutate(env, mem => G.sortear(mem, ci));
    }
    case 'sortearTodos':
      return mutate(env, mem => { let n = 0; C.forEach(c => { if (mem.el[c.i][0].length) { G.sortear(mem, c.i); n++; } }); return { times: n }; });
    case 'zerar':
      return mutate(env, mem => { mem.byH.clear(); mem.el.forEach(e => e.forEach(x => x.length = 0)); mem.fila = []; mem.tit = {}; return { ok: 1 }; });
    case 'restore': {
      if (!a.state || typeof a.state.p !== 'string') throw new Error('Backup inválido');
      const back = a.state;
      const r = await mutate(env, mem => { const m2 = G.decode(back); mem.byH = m2.byH; mem.el = m2.el; mem.fila = m2.fila; mem.tit = m2.tit || {}; mem.seq = m2.seq || 0; return { jogadores: m2.byH.size }; });
      if (a.cfg) await setKV(env, 'cfg', Object.assign({}, DEFAULT_CFG, a.cfg));
      return r;
    }
  }
  return null;
}

/* ---------------- rotas ---------------- */
async function api(req, env, ctx, url) {
  const p = url.pathname;
  if (p === '/api/state') {
    // guarda em cache por 10 s na borda: aguenta muita gente olhando o mapa ao mesmo tempo
    const cache = caches.default, key = new Request(url.origin + '/api/state');
    const hit = await cache.match(key); if (hit) return hit;
    const row = await getRow(env, 'state');
    const res = raw(statePayload(row ? row.v : JSON.stringify(G.newState()), row ? row.rev : 0), 200, { 'Cache-Control': 'public, max-age=10' });
    ctx.waitUntil(cache.put(key, res.clone()));
    const st = await getKV(env, 'ig-status', {});
    if (!env.SITE_URL && st.site !== url.origin && !/localhost|127\.0\.0\.1/.test(url.hostname)) { st.site = url.origin; ctx.waitUntil(igSetStatus(env, st)); }
    return res;
  }
  if (p === '/api/admin') {
    if (req.method !== 'POST') return json({ error: 'use POST' }, 405);
    let a; try { a = await req.json(); } catch (e) { return json({ error: 'JSON inválido' }, 400); }
    const info = await adminInfo(env);
    if (!info) {
      // primeiro acesso: quem abrir o painel agora cria a senha
      if (a.action !== 'setup') return json({ error: 'Crie a senha do painel.', needSetup: true }, 409);
      const k = String(a.newKey || '');
      if (k.length < 6) return json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, 400);
      const salt = crypto.randomUUID();
      await setKV(env, 'admin', { salt, hash: await sha(salt + '|' + k), at: Date.now() });
      return json({ ok: 1 });
    }
    if (!(await checkKey(env, a.key))) return json({ error: 'Senha incorreta' }, 401);
    if (a.action === 'login') return json({ ok: 1, cfg: await getCfg(env), ig: await igGetStatus(env) });
    if (a.action === 'settoken') {
      const t = String(a.token || '').trim();
      if (t.length < 50) return json({ error: 'Esse token parece incompleto. Copie o texto inteiro.' }, 400);
      await setKV(env, 'ig-token-manual', { token: t, at: Date.now() });
      return json({ ig: await igCheck(env) });
    }
    if (a.action === 'settings') {
      const cfg = await getCfg(env);
      if (typeof a.gameTag === 'string') cfg.gameTag = a.gameTag.trim().slice(0, 60);
      if (typeof a.autoReply === 'boolean') cfg.autoReply = a.autoReply;
      await setKV(env, 'cfg', cfg); return json({ cfg });
    }
    if (a.action === 'igstatus') return json({ ig: await igGetStatus(env) });
    if (a.action === 'igcheck') return json({ ig: await igCheck(env) });
    if (a.action === 'igpoll') { const r = await pollInstagram(env); const row = await getRow(env, 'state'); return raw(`{"res":${JSON.stringify(r)},"ig":${JSON.stringify(await igGetStatus(env))},"state":${statePayload(row ? row.v : JSON.stringify(G.newState()), row ? row.rev : 0)}}`, 200, { 'Cache-Control': 'no-store' }); }
    if (a.action === 'backup') { const row = await getRow(env, 'state'); return raw(`{"state":${row ? row.v : JSON.stringify(G.newState())},"cfg":${JSON.stringify(await getCfg(env))},"at":${Date.now()}}`, 200, { 'Cache-Control': 'no-store' }); }
    const r = await adminAction(env, a);
    if (!r) return json({ error: 'ação desconhecida' }, 400);
    ctx.waitUntil(caches.default.delete(new Request(url.origin + '/api/state')));
    return raw(`{"res":${JSON.stringify(r.res === undefined ? null : r.res)},"state":${statePayload(r.txt, r.rev)}}`, 200, { 'Cache-Control': 'no-store' });
  }
  if (p === '/api/instagram-webhook') {
    if (req.method === 'GET') {
      if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === (env.IG_VERIFY_TOKEN || 'clube-dos-seguidores'))
        return new Response(url.searchParams.get('hub.challenge') || '', { status: 200 });
      return new Response('token de verificação errado', { status: 403 });
    }
    const body = await req.text();
    if (env.IG_APP_SECRET) {
      const sig = req.headers.get('x-hub-signature-256') || '';
      if (sig !== 'sha256=' + await hmacHex(env.IG_APP_SECRET, body)) return new Response('assinatura inválida', { status: 401 });
    }
    ctx.waitUntil(processWebhook(env, JSON.parse(body || '{}')).catch(e => console.error(e)));
    return new Response('ok');
  }
  // narração do vídeo (arquivos WAV curtos, um por fala)
  const nm = p.match(/^\/api\/narracao\/([0-9])$/);
  if (nm) {
    const k = 'narr-' + nm[1];
    if (req.method === 'POST') {
      if ((req.headers.get('x-key') || '') !== (env.NARR_KEY || 'cds-narracao-7f3k9')) return json({ error: 'chave errada' }, 401);
      const buf = new Uint8Array(await req.arrayBuffer()); if (!buf.length || buf.length > 1400000) return json({ error: 'arquivo vazio ou grande demais' }, 400);
      let bin = ''; for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
      await setKV(env, k, { b64: btoa(bin), at: Date.now() }); return json({ ok: 1, bytes: buf.length });
    }
    const v = await getKV(env, k, null); if (!v) return json({ error: 'sem narração' }, 404);
    const bin = atob(v.b64), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return new Response(out, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' } });
  }
  if (p === '/api/status') {
    const tok = (env.IG_TOKEN || '').trim() || await manualToken(env), st = await igGetStatus(env), cfg = await getCfg(env);
    const row = await getRow(env, 'state'); let jogadores = 0, fila = 0;
    if (row) { try { const S = JSON.parse(row.v); jogadores = S.p ? S.p.split('\n').length : 0; fila = S.f ? S.f.split('\n').length : 0; } catch (e) {} }
    return json({
      agora: new Date().toISOString(), servidor: 'Cloudflare', jogadores, fila,
      senhaPainelConfigurada: !!(await adminInfo(env)), tokenConfigurado: !!tok, bancoDeDados: !!env.DB,
      hashtagDoJogo: cfg.gameTag || '(todos os vídeos)', respostaAutomatica: cfg.autoReply,
      instagram: {
        usuario: st.username || null, erro: st.error || null, erroAoResponder: st.replyError || null,
        ultimaLeitura: st.lastPoll ? new Date(st.lastPoll).toISOString() : null,
        ultimoWebhook: st.lastWebhook ? new Date(st.lastWebhook).toISOString() : null,
        videosDoJogoEncontrados: st.gamePosts ?? null, legendasVistas: st.captions || null,
        comentariosLidosNaUltimaLeitura: st.comentariosLidos ?? null, filtro: st.filtro || null,
        jogadoresQueEntraramPeloInstagram: st.imported || 0, respostasEnviadas: st.replies || 0, linkNasRespostas: siteUrl(env, st) || null,
      },
    });
  }
  return json({ error: 'não encontrado' }, 404);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      if (!env.DB) return json({ error: 'Banco de dados D1 não ligado (binding DB).' }, 500);
      try { return await api(req, env, ctx, url); } catch (e) { return json({ error: e.message }, 500); }
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pollInstagram(env).catch(e => console.error('leitura do Instagram', e)));
  },
};
