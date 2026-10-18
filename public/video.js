/* =============================================================
   CLUBE DOS SEGUIDORES — gerador do vídeo para Reels (1080x1920, 45 s)
   Abra o site com ?video no endereço. Gera um MP4 com legendas,
   música e (opcional) a narração que você enviar.
   ============================================================= */
(function () {
"use strict";
const W = window.__W, { THREE, scene, camera, renderer, controls, clubs, GC } = W;
const VW = 1080, VH = 1920, FPS = 30, DUR = 45, SR = 48000;
const INK = "#1c2230", SUN = "#ffc83d", FONT = '"Nunito", "Segoe UI", system-ui, sans-serif';

/* ---------- tela do gerador ---------- */
const css = document.createElement("style");
css.textContent = `
body.video{background:#141923;overflow:auto}
#vg{position:fixed;inset:0;display:flex;gap:22px;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font-family:${FONT};color:#fff}
#vg canvas{height:calc(100vh - 32px);aspect-ratio:9/16;max-width:56vw;border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.5);background:#000}
#vg .side{width:min(420px,40vw);display:flex;flex-direction:column;gap:12px;max-height:calc(100vh - 32px);overflow:auto}
#vg h1{margin:0;font-size:26px;font-weight:900}
#vg h1 span{color:${SUN}}
#vg .box{background:#1f2633;border:2px solid #2d3647;border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
#vg label{font-size:13px;color:#aeb7c8;font-weight:800;display:flex;flex-direction:column;gap:5px}
#vg select,#vg input[type=file]{font:800 14px ${FONT};color:#fff;background:#141923;border:2px solid #39445a;border-radius:10px;padding:7px}
#vg button{font:900 15px ${FONT};border:3px solid ${INK};border-radius:999px;padding:10px 16px;cursor:pointer;background:#fff;color:${INK};box-shadow:0 4px 0 #000}
#vg button.y{background:${SUN}}
#vg button:disabled{opacity:.5;cursor:wait}
#vg .bar{height:12px;background:#141923;border-radius:99px;overflow:hidden;border:2px solid #39445a}
#vg .bar i{display:block;height:100%;width:0;background:${SUN}}
#vg .st{font-size:13px;color:#cfd6e3;font-weight:700;line-height:1.4}
#vg .scr{font-size:13px;line-height:1.5;font-weight:700;color:#e6ebf3;white-space:pre-wrap}
#vg .scr b{color:${SUN}}
#vg a.dl{display:inline-block;text-align:center;font:900 15px ${FONT};border:3px solid ${INK};border-radius:999px;padding:10px 16px;background:#7ee0a0;color:${INK};text-decoration:none}
@media (max-width:800px){#vg{flex-direction:column;position:static;height:auto}#vg canvas{height:auto;width:100%;max-width:420px}#vg .side{width:100%;max-height:none}}`;
document.head.appendChild(css);
const SCRIPT = [
  [0, 3, "Pare tudo! O seu nome pode estar dentro do estádio do seu time!"],
  [3, 10, "É só comentar aqui embaixo o nome do seu time de coração, e você vira jogador dele no mapa."],
  [10, 18, "Os onze primeiros a comentar são os titulares, com posição sorteada. E o primeiro de todos vira o capitão!"],
  [18, 26, "Acabaram as onze vagas? Você vai pro time reserva. Depois vêm o sub-vinte e três, o sub-vinte e o sub-dezessete."],
  [26, 35, "São mais de duzentos times, do Flamengo ao Ipatinga. É o maior torneio 3D do mundo!"],
  [35, 45, "Segue o perfil! Em breve começa o Super Campeonato Brasileiro, pra ver qual time vai ser o campeão. Comenta agora o seu time!"]
];
const fmtT = s => "0:" + String(Math.floor(s)).padStart(2, "0");
const ui = document.createElement("div"); ui.id = "vg";
const sorted = clubs.slice().sort((a, b) => a.tier - b.tier || a.nome.localeCompare(b.nome));
ui.innerHTML = `<canvas id="vout" width="${VW}" height="${VH}"></canvas>
<div class="side">
  <h1>Gerador do <span>Reels</span></h1>
  <div class="box">
    <label for="vteam">time em destaque<select id="vteam">${sorted.map(c => `<option value="${c.i}"${c.nome === "Flamengo" ? " selected" : ""}>${c.nome}</option>`).join("")}</select></label>
    <label for="vnar">narração (opcional): MP3 ou WAV de até 45 s<input type="file" id="vnar" accept="audio/*" multiple></label>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button id="vplay">▶ prévia</button><button class="y" id="vgo">⬇ gerar MP4</button></div>
    <div class="bar"><i id="vbar"></i></div>
    <div class="st" id="vst">Pronto. A prévia toca em tempo real; o MP4 é gerado quadro a quadro (leva 1 a 3 minutos).</div>
    <div id="vdl"></div>
  </div>
  <div class="box"><div class="st"><b style="color:${SUN}">Roteiro da narração</b> — grave com a sua voz ou use "Texto para fala" no CapCut, e envie o áudio acima. Cada fala começa no tempo indicado.</div>
    <div class="scr">${SCRIPT.map(s => `<b>${fmtT(s[0])}–${fmtT(s[1])}</b>  ${s[2]}`).join("\n")}</div>
    <button id="vcopy">copiar roteiro</button>
  </div>
  <div class="box st">Legenda sugerida pro post:<br><span id="vcap" style="color:#fff">⚽ Comenta o nome do seu time e vira jogador dele! Os 11 primeiros são titulares e o 1º é o capitão 👑 São mais de 200 times no maior torneio 3D do mundo 🌍 Segue @joguenoseutime que os campeonatos começam em breve! #clubedosseguidores</span>
  <button id="vcopy2">copiar legenda</button></div>
</div>`;
document.body.appendChild(ui);
const out = document.getElementById("vout"), ctx = out.getContext("2d");
const $ = id => document.getElementById(id);
const copy = (txt, btn) => { (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { btn.textContent = "copiado ✓"; }).catch(() => { btn.textContent = "selecione e copie"; }); };
$("vcopy").onclick = () => copy(SCRIPT.map(s => `${fmtT(s[0])} ${s[2]}`).join("\n"), $("vcopy"));
$("vcopy2").onclick = () => copy($("vcap").textContent, $("vcopy2"));

renderer.setPixelRatio(1); renderer.setSize(VW, VH, false); camera.aspect = VW / VH; camera.fov = 50; camera.near = 0.5; camera.updateProjectionMatrix();

/* ---------- dados das cenas ---------- */
const HANDLES = ["pedrinho.fc", "ana.clara_07", "lucas_matheus", "gabi.santos", "rafa.oliveira10", "joaovitor_", "bia.lima", "enzo.gomes", "duda.ferreira", "caio_souza", "nicolas.r9", "leti.alves", "vitinho_77", "julia.martins", "kaua.rocha", "maria.eduarda", "theo.dias", "luiza.costa", "arthur_11", "isa.ribeiro", "miguel.ps", "sofia.melo"];
const COMMENTS = [["gabriel.silva", "MENGÃOOO 🔴⚫"], ["ana_luiza", "Vai Corinthians!! 🦅"], ["joao.galo", "GALOOO 🐔"], ["bia.verdao", "Palmeiras sempre 💚"], ["kaua_tigre", "IPATINGA!!! 🐯"], ["lucas.gremio", "Grêmio 💙🖤"], ["duda.bahia", "Bahêa!! 💙❤️"], ["pedro.fogao", "Fogãoooo ⭐"]];
let F = clubs.find(c => c.nome === "Flamengo").i, TOUR = [], baseS = null, curN = -1;
function setup() {
  F = +$("vteam").value;
  const pick = ["Flamengo", "Corinthians", "Palmeiras", "Grêmio", "São Paulo", "Ipatinga"].map(n => clubs.find(c => c.nome === n)).filter(c => c && c.i !== F);
  TOUR = [pick[0], pick[1], pick[2], pick[3], clubs.find(c => c.nome === "Ipatinga")].filter((c, i, a) => c && a.indexOf(c) === i).slice(0, 5);
  const m = W.getMem(); const S = GC.encode(m);
  S.p = S.p.split("\n").filter(l => l && +l.split("\t")[1] !== F).join("\n"); S.f = ""; S.tit = {};
  baseS = S; curN = -1; W.setSelected(F);
}
function setCount(n) {
  if (n === curN) return; curN = n;
  const m = GC.decode(baseS);
  for (let k = 0; k < n; k++) GC.join(m, HANDLES[k], F, false, W.mulberry(9000 + k * 31 + F));
  W.setMem(m); W.refreshPitchPlayers();
}
// quantos jogadores o time em destaque tem em cada momento, e quando cada um aparece
function appearAt(k, t) { if (t < 3) return 0.2 + k * 0.095; if (t < 18) return 10.7 + k * 0.5; return k < 11 ? 0 : 18.6 + (k - 11) * 0.33; }
function countAt(t) {
  if (t < 3) return Math.max(0, Math.min(22, Math.floor((t - 0.2) / 0.095) + 1));
  if (t < 10) return 22;
  if (t < 18) return Math.max(0, Math.min(11, Math.floor((t - 10.7) / 0.5) + 1));
  if (t < 26) return 11 + Math.max(0, Math.min(11, Math.floor((t - 18.6) / 0.33) + 1));
  return 22;
}

/* ---------- câmera ---------- */
const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x), easeOut = x => x < 0 ? 0 : x > 1 ? 1 : 1 - Math.pow(1 - x, 3);
const lerp = (a, b, k) => a + (b - a) * k;
const BR = { x: (W.minX + W.maxX) / 2 + 60, z: -(W.minY + W.maxY) / 2 - 40 };
function shotAt(t) { // alvo, distância, inclinação (0 = de cima), giro
  const c = clubs[F];
  if (t < 3) { const k = easeOut(t / 1.1); return { x: c.x, z: c.z, d: lerp(11, 25, k) + t * 0.5, p: 0.3, a: Math.PI / 2 + 0.25 - t * 0.06, cut: 0 }; }
  if (t < 10) {
    const k1 = ease((t - 3) / 1.7), k2 = ease((t - 9) / 1);
    const d = t < 9 ? lerp(22, 300, k1) : lerp(300, 23, k2), p = t < 9 ? lerp(0.38, 0.78, k1) : lerp(0.78, 0.36, k2);
    return { x: c.x, z: c.z, d: t < 9 ? lerp(26.5, 300, k1) : lerp(300, 27, k2), p, a: Math.PI / 2 + 0.07 + 0.5 * k1 - 0.57 * k2, cut: 0 };
  }
  if (t < 18) return { x: c.x, z: c.z, d: lerp(27, 25.5, (t - 10) / 8), p: 0.3, a: Math.PI / 2 + (t - 10) * 0.012, cut: 0 };
  if (t < 26) return { x: c.x, z: c.z, d: lerp(25.5, 29, ease((t - 18) / 8)), p: lerp(0.3, 0.55, ease((t - 18) / 5)), a: Math.PI / 2 + 0.1 + (t - 18) * 0.05, cut: 0 };
  if (t < 35) { const i = Math.min(TOUR.length - 1, Math.floor((t - 26) / 1.8)), lt = t - 26 - i * 1.8, cc = TOUR[i]; return { x: cc.x, z: cc.z, d: lerp(34, 27, lt / 1.8), p: 0.92, a: 2.2 + i * 1.3 + lt * 0.22, cut: i + 1, club: cc }; }
  const k = ease((t - 35) / 3.2), last = TOUR[TOUR.length - 1];
  return { x: lerp(last.x, BR.x, k), z: lerp(last.z, BR.z, k), d: lerp(30, 2050, Math.pow(k, 0.7)), p: lerp(0.92, 0.42, k), a: 0.2 + (t - 35) * 0.025, cut: 9 };
}
let lastCut = -1;
function placeCamera(t) {
  const s = shotAt(t), sh = (t < 0.45 ? (0.45 - t) * 1.6 : 0) + (Math.abs(t - 2.3) < 0.25 ? (0.25 - Math.abs(t - 2.3)) * 2 : 0);
  const sx = Math.sin(t * 91) * sh, sz = Math.cos(t * 77) * sh;
  controls.target.set(s.x, W.H, s.z);
  camera.position.set(s.x + Math.sin(s.p) * Math.sin(s.a) * s.d + sx, W.H + Math.cos(s.p) * s.d, s.z + Math.sin(s.p) * Math.cos(s.a) * s.d + sz);
  camera.lookAt(controls.target);
  if (s.cut !== lastCut) { lastCut = s.cut; for (let i = 0; i < 16; i++) W.animateWorld(t); } // troca de cena: atualiza a torcida perto da câmera
  return s;
}

/* ---------- desenho 2D (legendas, balões, comentários) ---------- */
const V = new THREE.Vector3();
function txt(s, x, y, size, color, o) {
  o = o || {}; const sc = o.scale === undefined ? 1 : o.scale; if (sc <= 0.01) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); if (o.rot) ctx.rotate(o.rot);
  ctx.font = `900 ${size}px ${FONT}`; ctx.textAlign = o.align || "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  ctx.lineWidth = o.stroke === undefined ? size * 0.2 : o.stroke; ctx.strokeStyle = o.strokeColor || INK;
  if (o.shadow !== false) { ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowOffsetY = size * 0.08; }
  if (ctx.lineWidth > 0) ctx.strokeText(s, 0, 0); ctx.shadowColor = "transparent"; ctx.fillStyle = color; ctx.fillText(s, 0, 0); ctx.restore();
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function pill(s, x, y, size, bg, fg, o) {
  o = o || {}; const sc = o.scale === undefined ? 1 : o.scale; if (sc <= 0.01) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.font = `900 ${size}px ${FONT}`;
  const w = ctx.measureText(s).width + size * 1.1, h = size * 1.55, bw = o.border === undefined ? Math.max(3, size * 0.12) : o.border;
  ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowOffsetY = size * 0.12; rr(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill(); ctx.shadowColor = "transparent";
  ctx.lineWidth = bw; ctx.strokeStyle = INK; ctx.stroke();
  if (o.tail) { ctx.beginPath(); ctx.moveTo(-9, h / 2 - 1); ctx.lineTo(0, h / 2 + 12); ctx.lineTo(9, h / 2 - 1); ctx.closePath(); ctx.fillStyle = INK; ctx.fill(); }
  ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(s, 0, size * 0.04); ctx.restore();
}
const pop = (t, t0, dur) => { const x = (t - t0) / (dur || 0.32); if (x <= 0) return 0; if (x >= 1) return 1; const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const fadeOut = (t, t1, d) => t < t1 ? 1 : Math.max(0, 1 - (t - t1) / (d || 0.25));
const pulse = (t, f) => 1 + Math.sin(t * (f || 7)) * 0.05;
const lum = hex => { const c = new THREE.Color(hex); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; };
function balloons(t, alpha) {
  const arr = W.players().get(F); if (!arr || alpha <= 0) return;
  const cap = W.getMem().el[F][0][0];
  ctx.globalAlpha = alpha;
  arr.forEach((p, j) => {
    const k = HANDLES.indexOf(p.h); V.set(p.x, W.PITCH_Y + 1.0, p.z).project(camera); if (V.z > 1) return;
    const x = (V.x * 0.5 + 0.5) * VW, y = (-V.y * 0.5 + 0.5) * VH - (j % 2 ? 22 : 0);
    const sc = pop(t, appearAt(k, t), 0.3), isCap = p.h === cap;
    pill((isCap ? "👑 " : "") + "@" + p.h, x, y, isCap ? 30 : 25, isCap ? SUN : p.res ? "#e3e9f3" : "#ffffff", INK, { scale: sc, tail: true, border: 3 });
  });
  ctx.globalAlpha = 1;
}
function comment(u, text, x, y, sc) {
  if (sc <= 0.01) return; ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  const w = 760, h = 118; ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowOffsetY = 8; rr(-w / 2, -h / 2, w, h, 30); ctx.fillStyle = "#fff"; ctx.fill(); ctx.shadowColor = "transparent";
  const g = ctx.createLinearGradient(-w / 2 + 30, -40, -w / 2 + 110, 40); g.addColorStop(0, "#f9ce34"); g.addColorStop(0.5, "#ee2a7b"); g.addColorStop(1, "#6228d7");
  ctx.beginPath(); ctx.arc(-w / 2 + 70, 0, 40, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.beginPath(); ctx.arc(-w / 2 + 70, 0, 33, 0, 7); ctx.fillStyle = "#dfe5ee"; ctx.fill();
  ctx.font = `900 34px ${FONT}`; ctx.fillStyle = "#7a8496"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(u[0].toUpperCase(), -w / 2 + 70, 2);
  ctx.textAlign = "left"; ctx.font = `900 30px ${FONT}`; ctx.fillStyle = "#1c2230"; ctx.fillText("@" + u, -w / 2 + 130, -22);
  ctx.font = `800 36px ${FONT}`; ctx.fillStyle = "#1c2230"; ctx.fillText(text, -w / 2 + 130, 22);
  ctx.font = `900 34px ${FONT}`; ctx.fillStyle = "#ee2a7b"; ctx.textAlign = "right"; ctx.fillText("♥", w / 2 - 34, 0);
  ctx.restore();
}
function overlay(t, shot) {
  const cx = VW / 2;
  // flashes nas viradas de cena
  const flash = [0, 3, 10, 18, 26, 35].reduce((m, c) => Math.max(m, t >= c && t < c + 0.18 ? 1 - (t - c) / 0.18 : 0), 0);
  // vinheta
  const vg = ctx.createRadialGradient(cx, VH / 2, VH * 0.3, cx, VH / 2, VH * 0.75); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.35)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (t < 3) {
    balloons(t, 1);
    const f1 = fadeOut(t, 0.55, 0.15);
    txt("PARE! ✋", cx, 600, 190, "#fff", { scale: pop(t, 0.02, 0.25) * f1 * (1 + Math.sin(t * 40) * 0.03 * f1), rot: -0.05 });
    if (t > 0.55) {
      txt("SEU NOME", cx, 380, 118, "#fff", { scale: pop(t, 0.6) });
      txt("DENTRO DO ESTÁDIO", cx, 510, 88, SUN, { scale: pop(t, 0.85) });
      txt("DO SEU TIME 😱", cx, 630, 104, "#fff", { scale: pop(t, 1.1) });
    }
    if (t > 2.0) pill("COMENTE SEU TIME 👇", cx, 1430, 66, SUN, INK, { scale: pop(t, 2.0) * pulse(t, 12) });
  } else if (t < 10) {
    txt("COMENTE O NOME", cx, 360, 100, "#fff", { scale: pop(t, 3.15) });
    txt("DO SEU TIME", cx, 480, 100, SUN, { scale: pop(t, 3.35) });
    txt("e vire JOGADOR dele ⚽", cx, 600, 64, "#fff", { scale: pop(t, 3.7) });
    // comentários chegando
    if (t < 9.6) { const vis = COMMENTS.map((c, i) => [c, 4.3 + i * 0.6]).filter(x => x[1] <= t).slice(-4);
      vis.forEach(([c, t0], k) => { const slot = vis.length - 1 - k; comment(c[0], c[1], cx, 1440 - slot * 140, pop(t, t0, 0.28) * (1 - slot * 0.04)); }); }
  } else if (t < 18) {
    balloons(t, 1);
    txt("OS 11 PRIMEIROS", cx, 330, 104, "#fff", { scale: pop(t, 10.2) });
    txt("SÃO TITULARES", cx, 450, 112, SUN, { scale: pop(t, 10.45) });
    const n = countAt(t);
    pill(`TITULARES ${n}/11`, cx, 1470, 54, "#fff", INK, { scale: pop(t, 10.7) });
    if (t > 11.2) pill("👑 O 1º A COMENTAR É O CAPITÃO", cx, 590, 46, SUN, INK, { scale: pop(t, 11.2) });
    if (t > 13.8) pill("🎲 posição sorteada", cx, 1370, 44, "#fff", INK, { scale: pop(t, 13.8) });
  } else if (t < 26) {
    const lad = t > 23;
    balloons(t, lad ? Math.max(0.25, 1 - (t - 23) * 2) : 1);
    if (!lad) {
      txt("ACABARAM AS VAGAS?", cx, 330, 92, "#fff", { scale: pop(t, 18.2) });
      txt("VAI PRO RESERVA 🔄", cx, 450, 100, SUN, { scale: pop(t, 18.45) });
      pill(`RESERVAS ${Math.max(0, countAt(t) - 11)}/11`, cx, 1470, 54, "#e3e9f3", INK, { scale: pop(t, 18.6) });
    } else {
      ctx.fillStyle = `rgba(20,25,35,${Math.min(0.62, (t - 23) * 2)})`; ctx.fillRect(0, 0, VW, VH);
      txt("E DEPOIS…", cx, 380, 96, "#fff", { scale: pop(t, 23.05) });
      [["⭐ TITULARES · 11", SUN], ["🔄 RESERVAS · 11", "#ffffff"], ["SUB-23 · 22", "#9fd9ff"], ["SUB-20 · 22", "#b9f0c4"], ["SUB-17 · 22", "#ffd0b0"]].forEach((r, i) => {
        const y = 560 + i * 175; pill(r[0], cx, y, 62, r[1], INK, { scale: pop(t, 23.25 + i * 0.32) }); if (i < 4) txt("▼", cx, y + 88, 44, "#fff", { scale: pop(t, 23.4 + i * 0.32), stroke: 8 }); });
    }
  } else if (t < 35) {
    const c = shot.club, i = shot.cut - 1, lt = t - 26 - i * 1.8;
    if (t < 30.5) { txt("+200 TIMES", cx, 380, 150, SUN, { scale: pop(t, 26.1) * pulse(t, 6) }); txt("do Flamengo ao Ipatinga 🏟️", cx, 520, 58, "#fff", { scale: pop(t, 26.4) }); }
    else { txt("O MAIOR TORNEIO", cx, 360, 100, "#fff", { scale: pop(t, 30.5) }); txt("3D DO MUNDO 🌍", cx, 485, 104, SUN, { scale: pop(t, 30.75) * pulse(t, 6) }); }
    if (c) pill(c.nome, cx, 1440, 72, c.c1, lum(c.c1) > 0.6 ? INK : "#fff", { scale: pop(t, 26 + i * 1.8 + 0.05, 0.25) });
  } else {
    txt("SEGUE O PERFIL", cx, 380, 104, "#fff", { scale: pop(t, 35.2) });
    pill("@joguenoseutime", cx, 520, 74, "#fff", INK, { scale: pop(t, 35.5) });
    if (t > 37.3) { txt("EM BREVE: 🏆", cx, 690, 80, "#fff", { scale: pop(t, 37.3) }); txt("SUPER CAMPEONATO", cx, 800, 92, SUN, { scale: pop(t, 37.55) }); txt("BRASILEIRO", cx, 905, 92, SUN, { scale: pop(t, 37.8) }); }
    if (t > 39.0) txt("qual time vai ser o campeão?", cx, 1015, 54, "#fff", { scale: pop(t, 39.0) });
    if (t > 39.5) pill("COMENTE SEU TIME 👇", cx, 1330, 76, SUN, INK, { scale: pop(t, 39.5) * pulse(t, 10) });
    if (t > 41.5) txt("e garanta a sua vaga!", cx, 1460, 60, "#fff", { scale: pop(t, 41.5) });
  }
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.85})`; ctx.fillRect(0, 0, VW, VH); }
}
function renderFrame(t) {
  setCount(countAt(t));
  const shot = placeCamera(t);
  W.animateWorld(t);
  renderer.render(scene, camera);
  ctx.drawImage(renderer.domElement, 0, 0, VW, VH);
  overlay(t, shot);
}

/* ---------- música e efeitos (gerados aqui mesmo) ---------- */
async function renderAudio(narration) {
  const oc = new OfflineAudioContext(2, SR * DUR, SR);
  const master = oc.createDynamicsCompressor(); master.threshold.value = -10; master.ratio.value = 6; master.connect(oc.destination);
  const music = oc.createGain(); music.gain.value = narration ? 0.42 : 0.85; music.connect(master);
  const noise = oc.createBuffer(1, SR, SR); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const BEAT = 60 / 124;
  const env = (g, t, a, peak, dcy) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); };
  const kick = (t, v) => { const o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); env(g, t, 0.003, v || 0.9, 0.3); o.connect(g).connect(music); o.start(t); o.stop(t + 0.4); };
  const nz = (t, type, f, v, dcy, q) => { const s = oc.createBufferSource(); s.buffer = noise; const fl = oc.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 0.8; const g = oc.createGain(); env(g, t, 0.002, v, dcy); s.connect(fl).connect(g).connect(music); s.start(t, Math.random() * 0.5); s.stop(t + dcy + 0.05); };
  const tone = (t, f, type, v, dur, lp) => { const o = oc.createOscillator(); o.type = type; o.frequency.value = f; const fl = oc.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp || 1800; const g = oc.createGain(); env(g, t, 0.01, v, dur); o.connect(fl).connect(g).connect(music); o.start(t); o.stop(t + dur + 0.05); };
  const riser = (t0, t1) => { const s = oc.createBufferSource(); s.buffer = noise; s.loop = true; const fl = oc.createBiquadFilter(); fl.type = "bandpass"; fl.Q.value = 1.4; fl.frequency.setValueAtTime(300, t0); fl.frequency.exponentialRampToValueAtTime(7000, t1); const g = oc.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t1); g.gain.linearRampToValueAtTime(0, t1 + 0.05); s.connect(fl).connect(g).connect(music); s.start(t0); s.stop(t1 + 0.1); };
  const impact = t => { kick(t, 1); const o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.9); env(g, t, 0.005, 0.8, 1.1); o.connect(g).connect(music); o.start(t); o.stop(t + 1.2); nz(t, "lowpass", 3000, 0.5, 0.5); };
  const popS = (t, f) => { const o = oc.createOscillator(), g = oc.createGain(); o.type = "sine"; o.frequency.setValueAtTime(f || 700, t); o.frequency.exponentialRampToValueAtTime((f || 700) * 2.2, t + 0.06); env(g, t, 0.003, 0.28, 0.08); o.connect(g).connect(music); o.start(t); o.stop(t + 0.12); };
  const PROG = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]]; // Am F C G
  const BASS = [110, 87.3, 130.8, 98];
  for (let b = 0, t = 0; t < DUR - 0.5; b++, t = b * BEAT) {
    const bar = Math.floor(b / 4), chord = PROG[bar % 4], quiet = (t > 8.6 && t < 10) || (t > 24.6 && t < 26) || t > 43.5;
    if (!quiet) kick(t, 0.85);
    if (!quiet && b % 2 === 1) nz(t, "bandpass", 1900, 0.5, 0.16, 0.7);
    nz(t + BEAT / 2, "highpass", 7500, 0.16, 0.05); if (t > 10) nz(t + BEAT / 4, "highpass", 9000, 0.07, 0.03);
    for (let e = 0; e < 2; e++) tone(t + e * BEAT / 2, BASS[bar % 4] * (e ? 2 : 1), "sawtooth", 0.16, BEAT / 2 - 0.03, 500);
    if (t > 10 && t < 43.5 && !quiet) chord.forEach(f => tone(t + BEAT / 2, f * 2, "sawtooth", 0.05, 0.18, 2600));
    if (t > 26 && t < 35 && b % 2 === 0) tone(t, chord[2] * 4, "square", 0.03, 0.12, 4000);
  }
  [0, 3, 10, 18, 26, 35].forEach(impact); riser(8.6, 10); riser(24.6, 26); riser(33.4, 35);
  for (let k = 0; k < 22; k++) popS(0.2 + k * 0.095, 650 + k * 30);
  for (let k = 0; k < 11; k++) popS(10.7 + k * 0.5, 600 + k * 40);
  for (let k = 0; k < 11; k++) popS(18.6 + k * 0.33, 520 + k * 30);
  COMMENTS.forEach((c, i) => popS(4.3 + i * 0.6, 900));
  for (let i = 0; i < 5; i++) popS(23.25 + i * 0.32, 500 + i * 120);
  if (narration) (Array.isArray(narration) ? narration : [[0, narration]]).forEach(([at, buf]) => { const s = oc.createBufferSource(); s.buffer = buf; const g = oc.createGain(); g.gain.value = 1.2; s.connect(g).connect(master); s.start(at); });
  return oc.startRendering();
}
let narrBuf = null;
$("vnar").onchange = async e => {
  const fs = [...e.target.files].sort((a, b) => a.name.localeCompare(b.name)); if (!fs.length) { narrBuf = null; return; }
  try { const ac = new AudioContext({ sampleRate: SR }); const bufs = []; for (const f of fs) bufs.push(await ac.decodeAudioData(await f.arrayBuffer())); ac.close();
    narrBuf = bufs.length === 1 ? bufs[0] : bufs.map((b, i) => [SCRIPT[Math.min(i, SCRIPT.length - 1)][0] + 0.15, b]);
    status(bufs.length === 1 ? `Narração carregada (${bufs[0].duration.toFixed(1)} s).` : `${bufs.length} falas carregadas, cada uma no seu tempo.`); }
  catch (err) { narrBuf = null; status("Não consegui ler esse áudio. Tente MP3 ou WAV."); }
};
const status = m => { $("vst").textContent = m; };
const bar = k => { $("vbar").style.width = (k * 100).toFixed(1) + "%"; };

/* ---------- prévia em tempo real ---------- */
let playing = null;
$("vplay").onclick = async () => {
  if (playing) { playing.stop(); return; }
  setup(); status("Preparando a prévia…");
  const buf = await renderAudio(narrBuf); const ac = new AudioContext(); const src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination);
  const t0 = ac.currentTime + 0.1; src.start(t0); let stop = false;
  playing = { stop: () => { stop = true; try { src.stop(); } catch (e) {} ac.close(); playing = null; $("vplay").textContent = "▶ prévia"; status("Prévia parada."); } };
  $("vplay").textContent = "■ parar"; status("Tocando a prévia (pode travar um pouco; o MP4 final sai liso).");
  (function frame() { if (stop) return; const t = ac.currentTime - t0; if (t >= DUR) { playing && playing.stop(); return; } if (t >= 0) { renderFrame(t); bar(t / DUR); } requestAnimationFrame(frame); })();
};

/* ---------- exportar MP4 ---------- */
function loadMuxer() { return window.Mp4Muxer ? Promise.resolve() : new Promise((ok, fail) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.js"; s.onload = ok; s.onerror = () => fail(new Error("não carregou o gerador de MP4")); document.head.appendChild(s); }); }
$("vgo").onclick = async () => {
  if (playing) playing.stop();
  if (!("VideoEncoder" in window)) { status("Esse navegador não gera MP4. Abra no Google Chrome ou no Edge atualizado."); return; }
  const btn = $("vgo"); btn.disabled = true; $("vdl").innerHTML = "";
  try {
    await loadMuxer(); setup(); status("Gerando a música…"); bar(0);
    const audio = await renderAudio(narrBuf);
    const aacOk = await AudioEncoder.isConfigSupported({ codec: "mp4a.40.2", sampleRate: SR, numberOfChannels: 2, bitrate: 192000 }).then(r => r.supported).catch(() => false);
    let vcodec = "avc1.640032"; if (!(await VideoEncoder.isConfigSupported({ codec: vcodec, width: VW, height: VH, bitrate: 12e6, framerate: FPS })).supported) vcodec = "avc1.4d0032";
    const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: "avc", width: VW, height: VH, frameRate: FPS }, audio: aacOk ? { codec: "aac", numberOfChannels: 2, sampleRate: SR } : undefined, fastStart: "in-memory" });
    let err = null;
    const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => err = e });
    venc.configure({ codec: vcodec, width: VW, height: VH, bitrate: 12e6, framerate: FPS, avc: { format: "avc" } });
    const total = window.__VG.test ? 90 : DUR * FPS; const tStart = performance.now();
    for (let f = 0; f < total; f++) {
      if (err) throw err;
      renderFrame(f / FPS);
      const vf = new VideoFrame(out, { timestamp: Math.round(f * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
      venc.encode(vf, { keyFrame: f % 60 === 0 }); vf.close();
      while (venc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));
      if (f % 15 === 0) { bar(f / total * 0.95); const el = (performance.now() - tStart) / 1000, eta = el / (f + 1) * (total - f); status(`Gerando o vídeo… ${Math.round(f / total * 100)}% (faltam ~${Math.ceil(eta)} s)`); await new Promise(r => setTimeout(r, 0)); }
    }
    await venc.flush(); venc.close();
    if (aacOk) {
      status("Juntando o áudio…");
      const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => err = e });
      aenc.configure({ codec: "mp4a.40.2", sampleRate: SR, numberOfChannels: 2, bitrate: 192000 });
      const L = audio.getChannelData(0), Rr = audio.getChannelData(1), CH = 1024;
      for (let i = 0; i < L.length; i += CH) { const n = Math.min(CH, L.length - i), data = new Float32Array(n * 2); data.set(L.subarray(i, i + n), 0); data.set(Rr.subarray(i, i + n), n);
        const ad = new AudioData({ format: "f32-planar", sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / SR * 1e6), data }); aenc.encode(ad); ad.close(); }
      await aenc.flush(); aenc.close();
    }
    if (err) throw err;
    muxer.finalize();
    const blob = new Blob([muxer.target.buffer], { type: "video/mp4" }), url = URL.createObjectURL(blob);
    const name = `reels-clube-dos-seguidores-${clubs[F].nome.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}.mp4`;
    $("vdl").innerHTML = `<a class="dl" href="${url}" download="${name}">⬇ baixar ${name} (${(blob.size / 1048576).toFixed(1)} MB)</a>`;
    window.__VG.last = { size: blob.size, aac: aacOk, codec: vcodec }; if (!window.__VG.test) $("vdl").querySelector("a").click();
    bar(1); status(`Pronto! Vídeo de 45 s em 1080x1920${aacOk ? (narrBuf ? " com narração e música" : " com música") : " (sem áudio: o navegador não gerou AAC)"}. Se o download não começar, use o botão verde.`);
  } catch (e) { status("Deu erro ao gerar: " + (e && e.message ? e.message : e)); }
  btn.disabled = false;
};

window.__VG = { renderFrame, setup };
/* narração gerada no computador e enviada pro servidor (/api/narracao/0..5) */
(async () => { try { const ac = new AudioContext({ sampleRate: SR }), bufs = [];
  for (let i = 0; i < SCRIPT.length; i++) { const r = await fetch("/api/narracao/" + i, { cache: "no-store" }); if (!r.ok) break; bufs.push(await ac.decodeAudioData(await r.arrayBuffer())); }
  ac.close(); if (bufs.length) { narrBuf = bufs.map((b, i) => [SCRIPT[i][0] + 0.15, b]); status(`Narração pronta: ${bufs.length} falas carregadas do servidor. Clique em gerar MP4.`); }
} catch (e) {} })();
/* primeiro quadro */
(document.fonts && document.fonts.load ? document.fonts.load(`900 60px Nunito`) : Promise.resolve()).then(() => { setup(); renderFrame(1.6); });
$("vteam").onchange = () => { setup(); renderFrame(1.6); };
})();
