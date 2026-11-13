// =============================================================================
// O jogador É o peão: ele fica de pé sobre um caminho de 32 casas gigantes que
// vai do escritório escuro até a luz da E3 (casa 32 = R$ 1 milhão por mês).
// Avançar: as casas acendem em sequência à frente dele e um único piscar o leva
// até a casa de destino (movimento confortável, sem deslizar a câmera).
// =============================================================================
import { THREE, ORG, YEL, COL, F_HEAD, F_BODY, camera, panel, glow, tw, E, op, clamp } from './motor.js';
import { sfx } from './audio.js';

const N = 32;
export const PASSO = 0.55;          // distância entre casas (m)
const LARG = 1.3, COMP = 0.47;      // tamanho de cada casa
const v3 = new THREE.Vector3();
const FAIXAS = { 1: 'R$ 10 mil', 5: 'R$ 30 mil', 9: 'R$ 70 mil', 13: 'R$ 150 mil', 17: 'R$ 300 mil', 21: 'R$ 500 mil', 25: 'R$ 700 mil', 29: 'R$ 850 mil' };

export const tab = { caminho: null, casa: 0, andando: false, casas: [], foco: null, peao: null };

// cor da casa: do laranja (início) ao amarelo (perto do milhão)
const corCasa = n => new THREE.Color(ORG).lerp(new THREE.Color(YEL), n / N);
const zCasa = n => -n * PASSO;

export function criarTabuleiro(parent) {
  const g = new THREE.Group();
  parent.add(g);
  tab.caminho = g;
  for (let n = 0; n <= N; n++) {
    const ultima = n === N;
    const w = ultima ? 2.6 : n === 0 ? LARG + 0.2 : LARG, c = ultima ? 1.4 : COMP;
    const casa = new THREE.Group();
    casa.position.set(0, 0, zCasa(n) - (ultima ? 0.5 : 0));
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, c),
      new THREE.MeshStandardMaterial({ color: 0x1a120c, emissive: corCasa(n), emissiveIntensity: 0.08, roughness: 0.5, metalness: 0.2 }));
    base.position.y = 0.025;
    const borda = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.05, c)),
      new THREE.LineBasicMaterial({ color: corCasa(n), transparent: true, opacity: 0.55 }));
    borda.position.y = 0.025;
    casa.add(base, borda);
    // número da casa no chão
    const rot = panel(ultima ? 1.6 : 0.5, ultima ? 0.4 : 0.22, (ctx, W, H, st) => {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (ultima) {
        ctx.fillStyle = COL.yellow; ctx.font = `800 13px ${F_HEAD}`; ctx.fillText('R$ 1 milhão/mês', W / 2, H / 2 - 5);
        ctx.fillStyle = COL.text; ctx.font = `700 5px ${F_BODY}`; ctx.fillText('CASA 32', W / 2, H / 2 + 9);
        return;
      }
      ctx.fillStyle = st.on ? COL.ink : n === 0 ? COL.yellow : 'rgba(236,236,236,0.75)';
      ctx.font = `800 ${n === 0 ? 7 : 11}px ${F_HEAD}`;
      ctx.fillText(n === 0 ? 'INÍCIO' : String(n), W / 2, H / 2 + 0.5);
    }, { on: false });
    rot.rotation.x = -Math.PI / 2;
    rot.position.y = 0.052;
    rot.renderOrder = 0;
    casa.add(rot);
    g.add(casa);
    tab.casas.push({ casa, base, borda, rot });
    // placas de faturamento na primeira casa de cada faixa
    if (FAIXAS[n]) {
      const placa = panel(0.6, 0.22, (ctx, W, H) => {
        ctx.beginPath(); ctx.roundRect(0.5, 0.5, W - 1, H - 1, 4); ctx.fillStyle = 'rgba(20,14,9,0.88)'; ctx.fill();
        ctx.lineWidth = 0.6; ctx.strokeStyle = `#${corCasa(n).getHexString()}`; ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = COL.mute; ctx.font = `700 3.6px ${F_BODY}`; ctx.fillText(`A PARTIR DA CASA ${n}`, W / 2, 6);
        ctx.fillStyle = COL.text; ctx.font = `800 8px ${F_HEAD}`; ctx.fillText(`${FAIXAS[n]}/mês`, W / 2, 14.5);
      });
      const lado = n % 8 === 1 ? -1 : 1;     // alterna os lados para não poluir
      placa.position.set(lado * (LARG / 2 + 0.5), 0.52, zCasa(n));
      placa.rotation.set(-0.35, -lado * 0.35, 0, 'YXZ');
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), new THREE.MeshBasicMaterial({ color: corCasa(n), transparent: true, opacity: 0.6 }));
      poste.position.set(lado * (LARG / 2 + 0.5), 0.21, zCasa(n));
      g.add(placa, poste);
    }
  }
  // arco de luz na chegada (casa 32)
  const arco = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.04, 12, 64, Math.PI), new THREE.MeshBasicMaterial({ color: YEL, transparent: true, opacity: 0.85, toneMapped: false }));
  arco.position.set(0, 0, zCasa(N) - 0.5);
  g.add(arco);
  const brilho = glow(3.5, YEL, 0.35); brilho.position.set(0, 1.4, zCasa(N) - 0.6); g.add(brilho);
  // marcador da casa de destino (para onde a luz-guia aponta)
  tab.foco = glow(0.6, YEL, 0.0);
  tab.foco.position.set(0, 0.3, 0);
  g.add(tab.foco);
  tab.peao = tab.foco;
  criarPiscar();
  posicionar(0);
  return g;
}

// o caminho anda para trás para o jogador ficar sobre a casa n (ele próprio não se move)
export function posicionar(n) {
  tab.casa = clamp(n, 0, N);
  tab.caminho.position.z = tab.casa * PASSO;
  tab.casas.forEach((c, i) => { c.base.material.emissive.copy(corCasa(i)); marcar(i, i > 0 && i <= tab.casa); });
  tab.foco.position.set(0, 0.3, zCasa(tab.casa));
}
function marcar(i, on) {
  const c = tab.casas[i];
  if (!c) return;
  c.base.material.emissiveIntensity = on ? 0.85 : i === N ? 0.4 : 0.08;
  op(c.borda, on ? 1 : 0.55);
  if (c.rot.userData.state.on !== on) { c.rot.userData.state.on = on; c.rot.userData.redraw(); }
}

// --- piscar (teleporte confortável) ----------------------------------------------
let veu = null;
function criarPiscar() {
  veu = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, fog: false }));
  veu.renderOrder = 999;
  veu.visible = false;
  camera.add(veu);
}
function piscar(noMeio) {
  return new Promise(resolve => {
    veu.visible = true;
    tw(0.18, k => { veu.material.opacity = k; }, {
      ease: E.lin,
      done: () => {
        noMeio();
        tw(0.25, k => { veu.material.opacity = 1 - k; }, { ease: E.lin, done: () => { veu.visible = false; resolve(); } });
      },
    });
  });
}

// Avança (ou volta) até "para": as casas do caminho acendem uma a uma e um único
// piscar leva o jogador até a casa de destino.
export function andar(de, para, { aoCruzarFaixa } = {}) {
  return new Promise(resolve => {
    tab.andando = true;
    const dir = para >= de ? 1 : -1;
    tab.foco.position.set(0, 0.3, zCasa(para));
    op(tab.foco, 0.9);
    const fim = () => { tab.andando = false; op(tab.foco, 0); resolve(); };
    if (de === para) {
      // permanece: a casa atual pulsa
      tw(0.9, k => { tab.casas[de].base.material.emissiveIntensity = 0.85 + 0.6 * Math.sin(k * Math.PI * 2); }, { ease: E.lin, done: () => { marcar(de, de > 0); fim(); } });
      return;
    }
    let i = de;
    const saltar = () => {
      tab.foco.getWorldPosition(v3);
      sfx('whoosh', v3);
      piscar(() => posicionar(para)).then(() => { sfx(dir > 0 ? 'sucesso' : 'chamado'); fim(); });
    };
    const acender = () => {
      if (i === para) { tw(0.35, () => {}, { ease: E.lin, done: saltar }); return; }
      i += dir;
      const alvo = dir > 0 ? i : i + 1;          // ao voltar, a casa que fica para trás acende em vermelho
      if (dir > 0) marcar(alvo, true);
      else { marcar(alvo, false); tab.casas[alvo].base.material.emissive.set(0xe0524b); tab.casas[alvo].base.material.emissiveIntensity = 0.7; }
      tab.casas[alvo].casa.getWorldPosition(v3);
      sfx(dir > 0 ? 'tick' : 'soltar', v3);
      if (dir > 0 && (FAIXAS[i] || i === N)) aoCruzarFaixa && aoCruzarFaixa(i, v3.clone().setY(1.2));
      tw(0.26, () => {}, { ease: E.lin, done: acender });
    };
    acender();
  });
}

// Carta surpresa: surge da casa à frente, gira e voa até o destino (posição do mundo).
export function virarCarta(destino, dur = 1.3) {
  return new Promise(resolve => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b1a0e, emissive: ORG, emissiveIntensity: 0.6, transparent: true });
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.008, 0.3), mat);
    const pai = tab.caminho.parent;
    tab.casas[Math.min(N, tab.casa + 2)].casa.getWorldPosition(v3);
    const de = pai.worldToLocal(v3.clone().setY(0.1));
    const para = pai.worldToLocal(destino.clone());
    pai.add(c);
    sfx('whoosh', v3);
    tw(dur, k => {
      c.position.lerpVectors(de, para, E.inOut(k));
      c.position.y += Math.sin(k * Math.PI) * 0.5;
      c.rotation.set(Math.PI / 2 * E.inOut(k), Math.PI * 2 * k, 0);
      c.scale.setScalar(1 + 2 * k);
      op(c, 1 - clamp((k - 0.8) / 0.2, 0, 1));
    }, { ease: E.lin, done: () => { pai.remove(c); c.geometry.dispose(); mat.dispose(); resolve(); } });
  });
}
