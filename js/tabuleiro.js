// =============================================================================
// Tabuleiro do Jogo do Crescimento E3: 32 casas em volta de um quadrado, sobre
// uma mesa à frente do jogador. O peão anda casa por casa a cada escolha.
// Volta completa (casa 32) = R$ 1 milhão por mês. A câmera nunca se move.
// =============================================================================
import { THREE, ORG, YEL, COL, F_HEAD, F_BODY, panel, glow, tw, E, op, clamp, lerp, rich } from './motor.js';
import { sfx } from './audio.js';
import { JOGO as J } from './jogo-dados.js';

const LADO = 1.5, CANTO = 0.24, N = 32;
const W = (LADO - 2 * CANTO) / 7;
const v3 = new THREE.Vector3();

// posição (x, z) do centro da casa n no tabuleiro (origem no centro; +z = lado do jogador)
export function posCasa(n) {
  n = ((n % N) + N) % N;
  const h = LADO / 2, c = CANTO / 2;
  if (n === 0) return [h - c, h - c];
  if (n < 8) return [h - CANTO - W * (n - 0.5), h - c];
  if (n === 8) return [-h + c, h - c];
  if (n < 16) return [-h + c, h - CANTO - W * (n - 8 - 0.5)];
  if (n === 16) return [-h + c, -h + c];
  if (n < 24) return [-h + CANTO + W * (n - 16 - 0.5), -h + c];
  if (n === 24) return [h - c, -h + c];
  return [h - c, -h + CANTO + W * (n - 24 - 0.5)];
}
const ehCanto = n => n % 8 === 0;
// rótulo de faturamento na primeira casa de cada faixa
const FAIXAS = { 1: 'R$ 10 mil', 5: 'R$ 30 mil', 9: 'R$ 70 mil', 13: 'R$ 150 mil', 17: 'R$ 300 mil', 21: 'R$ 500 mil', 25: 'R$ 700 mil', 29: 'R$ 850 mil' };
const CANTOS = { 0: ['INÍCIO', 'R$ 1 MILHÃO'], 8: ['CASA 8', 'R$ 30 mil'], 16: ['CASA 16', 'R$ 150 mil'], 24: ['CASA 24', 'R$ 500 mil'] };

export const tab = { grupo: null, peao: null, casa: 0, andando: false, topo: null, marcador: null, baralho: null };

export function criarTabuleiro(parent) {
  const g = new THREE.Group();
  g.position.set(0, 0.84, -1.75);
  g.rotation.x = 0.3;                         // inclinado na direção do jogador
  parent.add(g);
  tab.grupo = g;
  // mesa e base
  const mat = new THREE.MeshStandardMaterial({ color: 0x1c130c, roughness: 0.6, metalness: 0.2 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(LADO + 0.08, 0.05, LADO + 0.08), mat);
  base.position.y = -0.026;
  g.add(base);
  const borda = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(LADO + 0.08, 0.05, LADO + 0.08)),
    new THREE.LineBasicMaterial({ color: ORG, transparent: true, opacity: 0.8 }));
  borda.position.y = -0.026;
  g.add(borda);
  // superfície desenhada (casas, faixas de faturamento, centro)
  tab.topo = panel(LADO, LADO, (ctx, Wc, Hc, st) => desenharTopo(ctx, Wc, st), { casa: 0, visitadas: 0 });
  tab.topo.rotation.x = -Math.PI / 2;
  tab.topo.position.y = 0.002;
  tab.topo.material.depthWrite = false;
  tab.topo.renderOrder = 0;   // desenha antes dos cartões das opções, que ficam à frente
  g.add(tab.topo);
  // logo no centro
  // marcador da casa atual
  tab.marcador = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.075, 32), new THREE.MeshBasicMaterial({ color: YEL, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  tab.marcador.rotation.x = -Math.PI / 2;
  tab.marcador.position.y = 0.006;
  g.add(tab.marcador);
  // baralho de cartas surpresa no centro
  const baralho = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.006, 0.22), new THREE.MeshStandardMaterial({ color: i === 5 ? 0x2b1a0e : 0x1d140d, emissive: ORG, emissiveIntensity: i === 5 ? 0.35 : 0.1, transparent: true }));
    c.position.set(0.004 * i, 0.004 + i * 0.007, -0.003 * i);
    baralho.add(c);
  }
  const rotulo = panel(0.16, 0.22, (ctx, Wc, Hc) => {
    ctx.fillStyle = COL.orange; ctx.font = `800 3.4px ${F_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CARTA', Wc / 2, Hc / 2 - 2.5); ctx.fillText('SURPRESA', Wc / 2, Hc / 2 + 2.5);
  });
  rotulo.rotation.x = -Math.PI / 2;
  rotulo.position.set(0.02, 0.046, -0.015);
  baralho.add(rotulo);
  baralho.position.set(0.32, 0, 0.18);
  g.add(baralho);
  tab.baralho = baralho;
  // peão
  const pm = new THREE.MeshStandardMaterial({ color: 0xff7a33, emissive: ORG, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.4, transparent: true });
  const peao = new THREE.Group();
  const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.02, 24), pm); pe.position.y = 0.01;
  const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.04, 0.09, 24), pm); corpo.position.y = 0.065;
  const cab = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), pm); cab.position.y = 0.13;
  const luz = glow(0.25, ORG, 0.5); luz.position.y = 0.09;
  peao.add(pe, corpo, cab, luz);
  g.add(peao);
  tab.peao = peao;
  posicionar(0);
  return g;
}

function desenharTopo(ctx, Wc, st) {
  const cm = v => (v + LADO / 2) * 100;      // metros → cm do desenho
  // fundo
  ctx.fillStyle = '#120c07'; ctx.fillRect(0, 0, Wc, Wc);
  // centro
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = COL.orange; ctx.font = `700 4px ${F_BODY}`; ctx.letterSpacing = '1px';
  ctx.fillText('JOGO DO CRESCIMENTO E3', Wc / 2, Wc / 2 - 22);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = COL.text; ctx.font = `800 11px ${F_HEAD}`; ctx.fillText('Jornada', Wc / 2 - 14, Wc / 2 - 10);
  ctx.fillText('ao milhão', Wc / 2 - 14, Wc / 2 + 2);
  ctx.fillStyle = COL.mute; ctx.font = `600 3.6px ${F_BODY}`; ctx.fillText('Uma volta completa = R$ 1 milhão por mês', Wc / 2 - 14, Wc / 2 + 13);
  ctx.restore();
  // casas
  for (let n = 0; n < N; n++) {
    const [x, z] = posCasa(n);
    const canto = ehCanto(n);
    const horizontal = n < 8 || (n > 16 && n < 24);          // casas das bordas de perto e de longe
    const lx = canto ? CANTO : horizontal ? W : CANTO;
    const lz = canto ? CANTO : horizontal ? CANTO : W;
    const x0 = cm(x) - lx * 50, y0 = cm(z) - lz * 50, w = lx * 100, h = lz * 100;
    const visitada = n !== 0 && n <= st.visitadas;
    const progresso = n / N;
    ctx.beginPath(); ctx.roundRect(x0 + 0.6, y0 + 0.6, w - 1.2, h - 1.2, 1.5);
    const quente = `rgba(255,${Math.round(95 + 140 * progresso)},31,`;
    ctx.fillStyle = visitada ? quente + '0.85)' : 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.lineWidth = 0.35; ctx.strokeStyle = canto ? COL.yellow : quente + '0.6)'; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cx = x0 + w / 2, cy = y0 + h / 2;
    if (canto) {
      const [a, b] = CANTOS[n];
      ctx.fillStyle = visitada || (n === 0) ? COL.text : COL.mute;
      ctx.font = `800 3.2px ${F_HEAD}`; ctx.fillText(a, cx, cy - 3);
      ctx.fillStyle = n === 0 ? COL.yellow : COL.orange; ctx.font = `800 3.4px ${F_HEAD}`; ctx.fillText(b, cx, cy + 2.5);
    } else {
      ctx.fillStyle = visitada ? COL.ink : COL.mute;
      ctx.font = `700 3.6px ${F_HEAD}`; ctx.fillText(String(n), cx, FAIXAS[n] ? cy - 2.6 : cy);
      if (FAIXAS[n]) { ctx.font = `700 2.3px ${F_BODY}`; ctx.fillText(FAIXAS[n], cx, cy + 2.4); }
    }
  }
}

export function posicionar(n) {
  tab.casa = clamp(n, 0, N);
  const [x, z] = posCasa(tab.casa);
  tab.peao.position.set(x, 0.006, z);
  tab.marcador.position.set(x, 0.006, z);
  tab.topo.userData.state.visitadas = tab.casa;
  tab.topo.userData.redraw();
}

// Anda casa por casa de "de" até "para". Devolve uma promessa resolvida ao terminar.
export function andar(de, para, { aoCruzarFaixa } = {}) {
  return new Promise(resolve => {
    if (de === para) { pulinho(); setTimeout(resolve, 450); return; }
    tab.andando = true;
    const dir = para > de ? 1 : -1;
    let atual = de;
    const passo = () => {
      if (atual === para) { tab.andando = false; resolve(); return; }
      const prox = atual + dir;
      const [x0, z0] = posCasa(atual), [x1, z1] = posCasa(prox);
      tw(0.3, k => {
        tab.peao.position.set(lerp(x0, x1, k), 0.006 + Math.sin(k * Math.PI) * 0.09, lerp(z0, z1, k));
        tab.peao.rotation.y = Math.atan2(x1 - x0, z1 - z0);
      }, {
        ease: E.inOut,
        done: () => {
          atual = prox;
          tab.casa = atual;
          tab.marcador.position.set(x1, 0.006, z1);
          tab.topo.userData.state.visitadas = Math.max(0, dir > 0 ? atual : atual);
          tab.topo.userData.redraw();
          tab.peao.getWorldPosition(v3);
          sfx(dir > 0 ? 'tick' : 'soltar', v3);
          if (dir > 0 && (FAIXAS[atual] || atual === N)) aoCruzarFaixa && aoCruzarFaixa(atual, v3.clone());
          if (dir > 0 && ehCanto(atual)) faiscas(v3.clone());
          passo();
        },
      });
    };
    passo();
  });
}
function pulinho() {
  const y0 = tab.peao.position.y;
  tw(0.4, k => { tab.peao.position.y = y0 + Math.sin(k * Math.PI) * 0.05; }, { ease: E.lin });
}
function faiscas(pos) {
  const g = tab.grupo;
  const local = g.worldToLocal(pos.clone());
  const ps = Array.from({ length: 16 }, (_, i) => {
    const s = glow(0.05 + Math.random() * 0.05, i % 3 ? ORG : YEL);
    s.position.copy(local);
    s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.5);
    g.add(s);
    return s;
  });
  sfx('sucesso', pos);
  tw(1.1, k => ps.forEach(s => { s.position.set(local.x + s.userData.v.x * k, local.y + s.userData.v.y * k - 0.35 * k * k, local.z + s.userData.v.z * k); op(s, 1 - k); }),
    { ease: E.lin, done: () => ps.forEach(s => { g.remove(s); s.material.dispose(); }) });
}

// A carta do topo do baralho sobe, vira e voa até o destino (posição do mundo).
export function virarCarta(destino, dur = 1.3) {
  return new Promise(resolve => {
    const topoCarta = tab.baralho.children[5];
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.006, 0.22), topoCarta.material.clone());
    tab.baralho.getWorldPosition(v3);
    const de = v3.clone().add(new THREE.Vector3(0, 0.06, 0));
    c.position.copy(de);
    tab.grupo.parent.parent.add(c);
    const local = c.parent.worldToLocal(destino.clone());
    const de2 = c.parent.worldToLocal(de.clone());
    c.position.copy(de2);
    sfx('whoosh', de);
    tw(dur, k => {
      c.position.lerpVectors(de2, local, E.inOut(k));
      c.position.y += Math.sin(k * Math.PI) * 0.3;
      c.rotation.set(Math.PI / 2 * E.inOut(k), Math.PI * 2 * k, 0);
      c.scale.setScalar(1 + 2.5 * k);
      op(c, 1 - clamp((k - 0.8) / 0.2, 0, 1));
    }, { ease: E.lin, done: () => { c.parent.remove(c); c.material.dispose(); resolve(); } });
  });
}
