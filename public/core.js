/* =============================================================
   CLUBE DOS SEGUIDORES — regras do jogo (usadas pelo site e pelo servidor)
   ============================================================= */
(function (root) {
"use strict";
const ELENCOS = ["Principal", "Sub-23", "Sub-20", "Sub-17"];
const SLOTS = { GOL: 2, ZAG: 4, LD: 2, LE: 2, VOL: 3, MEI: 3, PE: 2, PD: 2, ATA: 2 }; // 22 por elenco
const POSN = { GOL: "Goleiro", ZAG: "Zagueiro", LD: "Lateral-direito", LE: "Lateral-esquerdo", VOL: "Volante", MEI: "Meia", PE: "Ponta-esquerda", PD: "Ponta-direita", ATA: "Centroavante" };
const POSP = { GOL: "Goleiros", ZAG: "Zagueiros", LD: "Laterais-dir.", LE: "Laterais-esq.", VOL: "Volantes", MEI: "Meias", PE: "Pontas-esq.", PD: "Pontas-dir.", ATA: "Centroavantes" };
const PER = 22, CAP = PER * ELENCOS.length;
// 4-3-3: [posição, x no campo (-1 a 1), y no campo]
const FORM = [["GOL",-0.9,0],["LD",-0.52,0.42],["ZAG",-0.6,0.15],["ZAG",-0.6,-0.15],["LE",-0.52,-0.42],["VOL",-0.22,0],["MEI",0.1,0.24],["MEI",0.1,-0.24],["PD",0.5,0.42],["ATA",0.62,0],["PE",0.5,-0.42]];

const norm = s => " " + String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim() + " ";
const nt = s => norm(s).trim();
const cleanH = h => String(h || "").trim().replace(/^@+/, "").toLowerCase();
const validH = h => /^[a-z0-9._]{1,30}$/.test(h);

/* ---------- times e apelidos ---------- */
let CLUBS = null, ALIASES = null, AMBIG = null, ALIASES2 = null, AMBIG2 = null;
function setup() {
  if (CLUBS) return;
  CLUBS = root.TIMES.map((t, i) => ({ i, nome: t[0], uf: t[1], cidade: t[2], lat: t[3], lon: t[4], c1: t[5], c2: t[6], est: t[7], tier: t[8], al: t[9] || "" }));
  const map = new Map();
  const add = (a, ci) => { a = nt(a); if (!a) return; if (!map.has(a)) map.set(a, new Set()); map.get(a).add(ci); };
  CLUBS.forEach(c => { add(c.nome, c.i); add(c.nome + " " + c.uf, c.i); c.al.split("|").forEach(a => add(a, c.i)); });
  ALIASES = []; AMBIG = new Map();
  map.forEach((set, a) => { if (set.size === 1) ALIASES.push([a, [...set][0]]); else AMBIG.set(a, [...set]); });
  // "atletico", "sao raimundo"… viram pergunta
  const pre = new Map();
  CLUBS.forEach(c => { const p = nt(c.nome.replace(/-.*$/, "")); if (p && p !== nt(c.nome)) { if (!pre.has(p)) pre.set(p, new Set()); pre.get(p).add(c.i); } });
  pre.forEach((set, p) => { if (!map.has(p)) AMBIG.set(p, [...set]); });
  ALIASES.sort((a, b) => b[0].length - a[0].length);
  // 2ª tentativa com letras repetidas juntas ("GALOOO", "mengaaao"): galooo -> galo
  const m2 = new Map();
  ALIASES.forEach(([a, ci]) => { const k = squash(a); if (!m2.has(k)) m2.set(k, new Set()); m2.get(k).add(ci); });
  ALIASES2 = []; AMBIG2 = new Map();
  m2.forEach((set, a) => { if (set.size === 1) ALIASES2.push([a, [...set][0]]); else AMBIG2.set(a, [...set]); });
  AMBIG.forEach((arr, a) => { const k = squash(a); if (!m2.has(k)) AMBIG2.set(k, arr); });
  ALIASES2.sort((a, b) => b[0].length - a[0].length);
}
const squash = s => s.replace(/([a-z])\1+/g, "$1");
function clubs() { setup(); return CLUBS; }
function matchIn(s, list, ambig) {
  let best = null;
  for (const [a, ci] of list) {
    if (best && a.length < best.len) break;
    if (s.includes(" " + a + " ")) { if (!best) best = { len: a.length, set: new Set([ci]) }; else best.set.add(ci); }
  }
  if (best) { const arr = [...best.set]; return arr.length === 1 ? { ci: arr[0] } : { amb: arr }; }
  for (const [a, arr] of ambig) if (s.includes(" " + a + " ")) return { amb: arr };
  return null;
}
function findClub(text) {
  setup();
  const s = norm(text);
  return matchIn(s, ALIASES, AMBIG) || matchIn(squash(s), ALIASES2, AMBIG2);
}

/* ---------- estado ----------
   Guardado como texto compacto para aguentar 20 mil+ jogadores:
   p: uma linha por jogador  "@\ttime\telenco\tposição\texemplo"
   f: fila de espera         "@\ttime\texemplo"
   tit: titulares sorteados  { time: [11 @ ou null] }                         */
function newState() { return { p: "", f: "", tit: {}, seq: 0 }; }
function decode(S) {
  setup();
  const mem = { byH: new Map(), el: CLUBS.map(() => [[], [], [], []]), fila: [], tit: (S && S.tit) || {}, seq: (S && S.seq) || 0 };
  const P = (S && S.p) || "";
  if (P) for (const ln of P.split("\n")) {
    const a = ln.split("\t"); if (a.length < 4) continue;
    const c = +a[1], e = +a[2]; if (!mem.el[c] || !(e >= 0 && e < ELENCOS.length) || !SLOTS[a[3]] || mem.byH.has(a[0])) continue;
    const r = { h: a[0], c, e, pos: a[3] }; if (a[4] === "1") r.ex = 1;
    mem.byH.set(r.h, r); mem.el[c][e].push(r.h);
  }
  const F = (S && S.f) || "";
  if (F) for (const ln of F.split("\n")) { const a = ln.split("\t"); if (a.length < 2 || !mem.el[+a[1]] || mem.byH.has(a[0])) continue; const r = { h: a[0], c: +a[1] }; if (a[2] === "1") r.ex = 1; mem.fila.push(r); }
  return mem;
}
function encode(mem) {
  const lines = [];
  mem.byH.forEach(r => lines.push(r.h + "\t" + r.c + "\t" + r.e + "\t" + r.pos + (r.ex ? "\t1" : "")));
  return { p: lines.join("\n"), f: mem.fila.map(r => r.h + "\t" + r.c + (r.ex ? "\t1" : "")).join("\n"), tit: mem.tit, seq: mem.seq };
}
const total = (mem, ci) => { const e = mem.el[ci]; return e[0].length + e[1].length + e[2].length + e[3].length; };
const openEl = (mem, ci) => { for (let e = 0; e < ELENCOS.length; e++) if (mem.el[ci][e].length < PER) return e; return -1; };
function freeSlots(mem, ci, e) {
  const used = {}; mem.el[ci][e].forEach(h => { const p = mem.byH.get(h).pos; used[p] = (used[p] || 0) + 1; });
  const out = []; for (const k in SLOTS) for (let j = used[k] || 0; j < SLOTS[k]; j++) out.push(k); return out;
}
function place(mem, h, ci, ex, rnd) {
  for (let e = 0; e < ELENCOS.length; e++) {
    const fs = freeSlots(mem, ci, e);
    if (fs.length) { const pos = fs[Math.floor(rnd() * fs.length)]; const r = { h, c: ci, e, pos }; if (ex) r.ex = 1; mem.byH.set(h, r); mem.el[ci][e].push(h); mem.seq++; return r; }
  }
  return null;
}
function join(mem, h, ci, ex, rnd) {
  rnd = rnd || Math.random;
  const cur = mem.byH.get(h); if (cur) return { st: "ja", c: cur.c, e: cur.e, pos: cur.pos };
  const f = mem.fila.find(x => x.h === h); if (f) return { st: "filaja", c: f.c };
  const r = place(mem, h, ci, ex, rnd);
  if (r) return { st: "ok", c: ci, e: r.e, pos: r.pos };
  mem.fila.push(ex ? { h, c: ci, ex: 1 } : { h, c: ci });
  return { st: "fila", c: ci, n: mem.fila.filter(x => x.c === ci).length };
}
// tira o jogador (ou da fila) e coloca o 1º da fila desse time no lugar
function remove(mem, h, rnd) {
  const r = mem.byH.get(h);
  if (!r) { const n = mem.fila.length; mem.fila = mem.fila.filter(x => x.h !== h); return n !== mem.fila.length ? { st: "fila" } : null; }
  mem.byH.delete(h); const arr = mem.el[r.c][r.e]; arr.splice(arr.indexOf(h), 1);
  if (mem.tit[r.c]) delete mem.tit[r.c];
  const i = mem.fila.findIndex(x => x.c === r.c);
  let promoted = null;
  if (i >= 0) { const f = mem.fila.splice(i, 1)[0]; const nr = place(mem, f.h, f.c, f.ex, rnd || Math.random); promoted = nr && nr.h; }
  return { st: "ok", c: r.c, promoted };
}
function sortear(mem, ci, rnd) {
  rnd = rnd || Math.random;
  const pool = {}; mem.el[ci][0].forEach(h => { const p = mem.byH.get(h).pos; (pool[p] = pool[p] || []).push(h); });
  for (const k in pool) for (let i = pool[k].length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[k][i], pool[k][j]] = [pool[k][j], pool[k][i]]; }
  mem.tit[ci] = FORM.map(f => (pool[f[0]] && pool[f[0]].length) ? pool[f[0]].pop() : null);
  return mem.tit[ci];
}
// titulares guardados ainda valem? (se alguém saiu do Principal ou entrou alguém numa vaga vazia, sorteia de novo)
function titValid(mem, ci) {
  const t = mem.tit[ci]; if (!t || t.length !== FORM.length) return false;
  const princ = new Set(mem.el[ci][0]);
  if (t.some(h => h && !princ.has(h))) return false;
  const counts = {}; mem.el[ci][0].forEach(h => { const p = mem.byH.get(h).pos; counts[p] = (counts[p] || 0) + 1; });
  const need = {}; FORM.forEach(f => need[f[0]] = (need[f[0]] || 0) + 1);
  let canFill = 0; for (const k in need) canFill += Math.min(need[k], counts[k] || 0);
  return t.filter(Boolean).length >= canFill;
}

/* ---------- comentários do Instagram ---------- */
// ev: { user, text, parent? }  →  resultado para a resposta automática
function processComment(mem, ev, rnd) {
  if (ev.parent) return null;               // respostas a comentários não contam
  const h = cleanH(ev.user); if (!validH(h) || h === cleanH(ev.ownUser)) return null;
  const cur = mem.byH.get(h);
  if (cur) return { user: h, kind: "ja", c: cur.c, pos: cur.pos, e: cur.e };
  const fl = mem.fila.find(x => x.h === h);
  if (fl) return { user: h, kind: "filaja", c: fl.c };
  const fc = findClub(ev.text);
  if (!fc) return { user: h, kind: "semTime" };
  if (fc.amb) return { user: h, kind: "amb", amb: fc.amb };
  const r = join(mem, h, fc.ci, false, rnd);
  if (r.st === "ok") return { user: h, kind: "ok", c: r.c, e: r.e, pos: r.pos };
  return { user: h, kind: "fila", c: r.c, n: r.n };
}
function replyText(R, site) {
  setup();
  const link = site ? " " + site.replace(/\/$/, "") : "";
  const nome = i => CLUBS[i].nome;
  if (R.kind === "ok") return `⚽ @${R.user}, agora você é ${POSN[R.pos]} do ${nome(R.c)} (${ELENCOS[R.e]})! Seu @ já está no estádio:${link}`;
  if (R.kind === "fila") return `😱 O ${nome(R.c)} lotou! @${R.user}, você é o nº ${R.n} da fila de espera. Quando abrir vaga, você entra.`;
  if (R.kind === "semTime") return `🤔 @${R.user}, não achei seu time. Comente só o nome dele, tipo "Galo", "Flamengo" ou "Ipatinga".`;
  if (R.kind === "amb") return `@${R.user}, qual deles? ${R.amb.slice(0, 4).map(nome).join(", ")}. Comente o nome completo 😉`;
  return null;
}
function isGameCaption(settings, caption) {
  const tag = nt((settings && settings.gameTag) || "");
  if (!tag) return true;
  return norm(caption).includes(" " + tag + " ");
}

root.GameCore = { ELENCOS, SLOTS, POSN, POSP, PER, CAP, FORM, norm, nt, cleanH, validH, clubs, findClub, newState, decode, encode, total, openEl, freeSlots, join, remove, sortear, titValid, processComment, replyText, isGameCaption };
})(typeof window !== "undefined" ? window : globalThis);
