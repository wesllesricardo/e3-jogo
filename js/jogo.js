// =============================================================================
// Jogo do Crescimento E3 (VR). O visitante comanda um escritório por 12 meses
// num tabuleiro circular à sua volta: roleta do mercado + uma decisão por mês.
// Um "escritório sem método" joga o mesmo ano só esperando indicação.
// Regras e números em jogo-dados.js.
// =============================================================================
import {
  THREE, DEG, ORG, YEL, COL, F_HEAD, F_BODY, S, hooks, tocou, renderer, scene, camera, world,
  panel, rich, eyebrow, cardBg, pill, card, botao, setLabel, place, glow, tw, E, reveal, leave, kill, setAlpha, op,
  clamp, lerp, updateTweens, updateUpdaters, updatePointers, updateCameraTela, yawCabeca, view, addUpdater, click, clicavel,
} from './motor.js';
import { iniciarAudio, setHumor, sfx, narrar, pararNarracao, updateAudio, setNarracaoAtiva, audio } from './audio.js';
import { amb, setProg, setLuz, updateAmbiente, carregarLogo, girarNucleo } from './ambiente.js';
import { criarGuia, guia, updateGuia } from './guia.js';
import { JOGO as J } from './jogo-dados.js';
import { CONTEUDO as K, CONFIG } from './conteudo.js';

const params = new URLSearchParams(location.search);
const ESTACAO = params.get('estacao') ? `Estação ${params.get('estacao')}` : CONFIG.estacaoPadrao;
const v3 = new THREE.Vector3();
const PASSO = 360 / J.meses;          // graus entre as casas do tabuleiro
const RT = 2.25;                      // raio do tabuleiro (m)
amb.semFrio = true;

hooks.clique = m => sfx('clique', m.getWorldPosition(v3));
hooks.hover = () => sfx('hover');
renderer.setClearColor(0x2b2e33, 1);

const brl = v => (v < 0 ? '−' : '') + 'R$ ' + Math.abs(Math.round(v)).toLocaleString('pt-BR');
const pct = v => Math.round(v * 100) + '%';
const carta = id => J.cartas.find(c => c.id === id);

// ------------------------------------------------------------------ estado ---
let est;
function novoEstado() {
  return {
    fase: 'intro', mes: 0, codigo: 'E3-' + String(Math.floor(1000 + Math.random() * 9000)),
    eu: { tomou: new Set(), e3Desde: null, organico: 0, caixa: J.base.caixa, contratos: 0, fat: 0, esperas: 0, hist: [] },
    rival: { tomou: new Set(), e3Desde: null, organico: 0, caixa: J.base.caixa, contratos: 0, fat: 0, hist: [] },
    evento: null,
  };
}

// --------------------------------------------------------------- simulação ---
function mensais(P) { let s = 0; for (const id of P.tomou) s += carta(id).mensal || 0; return s; }
function calcular(P, ev, mes) {
  const e3 = P.e3Desde !== null && mes > P.e3Desde;
  const tem = id => P.tomou.has(id) || (e3 && J.e3Inclui.includes(id));
  const B = J.base;
  let leadsInd = B.leadsIndicacao + Math.min(P.organico, 8);
  let leadsAds = (P.tomou.has('anuncios') ? B.leadsAnuncio : 0) + (P.tomou.has('escala') ? B.leadsEscala : 0) + (e3 ? B.leadsE3 : 0) + (P.tomou.has('expandir') ? 4 : 0);
  const qual = Math.min(1, B.qualidade + (tem('landing') ? 0.2 : 0) + (tem('produto') ? 0.15 : 0) + (e3 ? 0.15 : 0));
  let conv = B.conversao + (tem('crm') ? B.ganhoCrm : 0) + (tem('treino') ? B.ganhoTreino : 0) + (P.tomou.has('atendente') ? B.ganhoAtendente : 0) + (e3 ? B.ganhoE3 : 0) - (P.tomou.has('organico') ? 0.01 : 0);
  const ticket = B.ticket * (1 + (tem('produto') ? B.ganhoProduto : 0) + (P.tomou.has('expandir') ? 0.1 : 0));
  const notas = [];
  let bonus = 0, mult = 1;
  switch (ev.id) {
    case 'indicacao': bonus += 2; notas.push({ bom: true, t: '+2 contratos por indicação' }); break;
    case 'concorrente':
      if (leadsAds === 0) notas.push({ bom: null, t: 'Você não anuncia: nada muda' });
      else if (qual >= 0.85) notas.push({ bom: true, t: 'Sua página e seu produto seguraram os leads' });
      else { leadsAds *= 0.7; notas.push({ bom: false, t: '−30% nos contatos de anúncio' }); }
      break;
    case 'esfriou':
      if (tem('crm')) notas.push({ bom: true, t: 'O CRM com IA respondeu na hora: nenhum lead perdido' });
      else { mult *= 0.65; notas.push({ bom: false, t: '−35% nos contratos: os leads esfriaram' }); }
      break;
    case 'parado': leadsInd *= 0.7; leadsAds *= 0.7; notas.push({ bom: false, t: '−30% nos contatos' }); break;
    case 'viral': {
      const n = (P.tomou.has('organico') || e3) ? 8 : 2;
      leadsInd += n;
      notas.push({ bom: true, t: `+${n} contatos${n > 2 ? ': sua presença nas redes aproveitou' : ''}` });
      break;
    }
    case 'regra':
      if (tem('produto')) { leadsInd *= 1.4; leadsAds *= 1.4; notas.push({ bom: true, t: 'Seu produto jurídico aproveitou: +40% contatos' }); }
      else { leadsInd *= 1.1; notas.push({ bom: true, t: '+10% contatos' }); }
      break;
    case 'saiu':
      if (tem('treino')) notas.push({ bom: true, t: 'Atendimento documentado: ninguém sentiu a falta' });
      else { conv *= 0.75; notas.push({ bom: false, t: '−25% na conversão' }); }
      break;
    default: notas.push({ bom: null, t: 'Nada de diferente no mercado' });
  }
  const contratos = Math.max(0, Math.round((leadsInd * conv + leadsAds * conv * qual) * mult) + bonus);
  const receita = contratos * ticket;
  const custos = B.custoFixo + mensais(P);
  return { leads: Math.round(leadsInd + leadsAds), conv, qual, contratos, receita, custos, saldo: receita - custos, ticket, notas, e3 };
}
function aplicarMes(P, r) {
  P.caixa += r.saldo;
  P.contratos += r.contratos;
  P.fat += r.receita;
  P.hist.push(r);
  if (P.tomou.has('organico')) P.organico++;
}
function ofertas(m) {
  const P = est.eu;
  const disp = J.cartas.filter(c => !c.sempre && !P.tomou.has(c.id)
    && !(c.requer && !c.requer.some(r => P.tomou.has(r)))
    && !(P.tomou.has('e3') && J.e3Inclui.includes(c.id))
    && !(c.aPartirDoMes && m + 1 < c.aPartirDoMes));
  const ordem = ['aquisicao', 'comercial', 'produto'];
  const lista = [];
  const e3 = disp.find(c => c.id === 'e3');
  if (e3 && m >= 2 && m % 2 === 0) lista.push(e3);
  for (let k = 0; k < 3 && lista.length < 2; k++) {
    const c = disp.find(x => x.pilar === ordem[(m + k) % 3] && !lista.includes(x));
    if (c) lista.push(c);
  }
  for (const c of disp) if (lista.length < 2 && !lista.includes(c)) lista.push(c);
  lista.push(carta('indicacao'));
  return lista;
}
function escolher(c) {
  const P = est.eu;
  if (c.id === 'indicacao') P.esperas++;
  else {
    P.tomou.add(c.id);
    P.caixa -= c.custo || 0;
    if (c.id === 'e3') P.e3Desde = est.mes;
  }
}

// ================================================================ cenário ===
const mesa = new THREE.Group();          // tabuleiro (fixo no chão)
world.add(mesa);
const palco = new THREE.Group();         // painéis que giram até a casa do mês
world.add(palco);
let casas = [], peao = null, peaoRival = null, painel = null, roleta = null, area = null, telaIntro = null;

function anguloCasa(m) { return m * PASSO; }
function posCasa(m, r = RT, out = new THREE.Vector3()) {
  const a = anguloCasa(m) * DEG;
  return out.set(Math.sin(a) * r, 0, -Math.cos(a) * r);
}

function criarTabuleiro() {
  const matCasa = () => new THREE.MeshStandardMaterial({ color: 0x1d140d, emissive: ORG, emissiveIntensity: 0.15, roughness: 0.5, metalness: 0.2, transparent: true });
  for (let m = 0; m < J.meses; m++) {
    const g = new THREE.Group();
    posCasa(m, RT, g.position);
    g.rotation.y = -anguloCasa(m) * DEG;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.42), matCasa());
    base.position.y = 0.025;
    g.add(base);
    const placa = panel(0.5, 0.2, (ctx, W, H, s) => {
      ctx.beginPath(); ctx.roundRect(0.5, 0.5, W - 1, H - 1, 4);
      ctx.fillStyle = s.estado === 'atual' ? COL.yellow : 'rgba(20,16,12,0.9)'; ctx.fill();
      ctx.lineWidth = 0.6; ctx.strokeStyle = s.estado === 'ruim' ? '#E0524B' : COL.orange; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 4.6px ${F_BODY}`; ctx.fillStyle = s.estado === 'atual' ? COL.ink : COL.mute;
      ctx.fillText(`MÊS ${m + 1}`, W / 2, 6);
      ctx.font = `800 7.5px ${F_HEAD}`; ctx.fillStyle = s.estado === 'atual' ? COL.ink : COL.text;
      ctx.fillText(s.txt || '—', W / 2, 14);
    }, { estado: 'futuro', txt: '' });
    placa.position.set(0, 0.32, -0.26);
    placa.rotation.x = -0.25;
    g.add(placa);
    mesa.add(g);
    casas.push({ g, base, placa });
  }
  // trilha luminosa ligando as casas
  const pts = Array.from({ length: 121 }, (_, i) => { const a = (i / 120) * Math.PI * 2; return new THREE.Vector3(Math.sin(a) * RT, 0.012, -Math.cos(a) * RT); });
  const trilha = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: ORG, transparent: true, opacity: 0.45 }));
  mesa.add(trilha);
  // peões: o seu (laranja, brilhante) e o do escritório sem método (cinza)
  const fazPeao = (cor, emiss) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: cor, emissive: emiss, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4, transparent: true });
    const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.22, 24), mat);
    corpo.position.y = 0.16;
    const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 16), mat);
    cabeca.position.y = 0.33;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 24), mat);
    base.position.y = 0.07;
    g.add(corpo, cabeca, base);
    return g;
  };
  peao = fazPeao(0xff7a33, ORG);
  peao.add(glow(0.5, ORG, 0.5));
  peao.children[3].position.y = 0.3;
  peaoRival = fazPeao(0x3a4652, 0x10161c);
  mesa.add(peao, peaoRival);
  moverPeoes(0, true);
}
function moverPeoes(m, instantaneo = false) {
  const alvoEu = posCasa(m, RT + 0.05).clone(), alvoRiv = posCasa(m, RT - 0.55).clone();
  if (instantaneo) { peao.position.copy(alvoEu); peaoRival.position.copy(alvoRiv); return; }
  const de1 = peao.position.clone(), de2 = peaoRival.position.clone();
  const a0 = Math.atan2(de1.x, -de1.z), a1 = anguloCasa(m) * DEG;
  let da = a1 - a0; while (da < -Math.PI) da += 2 * Math.PI; while (da > Math.PI) da -= 2 * Math.PI;
  tw(0.9, k => {
    const a = a0 + da * k;
    peao.position.set(Math.sin(a) * (RT + 0.05), Math.sin(k * Math.PI) * 0.18, -Math.cos(a) * (RT + 0.05));
    peaoRival.position.set(Math.sin(a) * (RT - 0.55), Math.sin(k * Math.PI) * 0.05, -Math.cos(a) * (RT - 0.55));
  }, { ease: E.inOut });
}
function marcarCasa(m, estado, txt) {
  const p = casas[m].placa;
  p.userData.state.estado = estado;
  if (txt !== undefined) p.userData.state.txt = txt;
  p.userData.redraw();
  casas[m].base.material.emissiveIntensity = estado === 'atual' ? 0.9 : estado === 'futuro' ? 0.15 : 0.45;
  casas[m].base.material.emissive.set(estado === 'ruim' ? 0xe0524b : estado === 'atual' ? YEL : ORG);
}
function girarPalco(m, dur = 1.2) {
  const de = palco.rotation.y, para = -anguloCasa(m) * DEG;
  let d = para - de; while (d < -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI;
  tw(dur, k => { palco.rotation.y = de + d * k; }, { ease: E.inOut });
}

// painel de números (fixo no palco, acima do tabuleiro) ------------------------
function criarPainel() {
  painel = panel(2.3, 0.4, (ctx, W, H, s) => {
    cardBg(ctx, W, H, { r: 6 });
    const P = est.eu, R = est.rival;
    const cols = [
      ['Mês', `${Math.min(est.mes + 1, J.meses)} de ${J.meses}`],
      ['Caixa', brl(P.caixa)],
      ['Contratos no ano', String(P.contratos)],
      ['Faturamento no ano', brl(P.fat)],
    ];
    const cw = (W - 20) / cols.length;
    cols.forEach(([r, v], i) => {
      const x = 10 + i * cw;
      ctx.font = `700 3.8px ${F_BODY}`; ctx.letterSpacing = '0.6px'; ctx.fillStyle = COL.mute; ctx.fillText(r.toUpperCase(), x, 7);
      ctx.letterSpacing = '0px';
      ctx.font = `800 8.5px ${F_HEAD}`; ctx.fillStyle = i === 1 && P.caixa < 0 ? '#FF7A70' : COL.text; ctx.fillText(v, x, 13);
    });
    ctx.fillStyle = COL.line; ctx.fillRect(10, 26, W - 20, 0.3);
    ctx.font = `600 4.4px ${F_BODY}`; ctx.fillStyle = COL.frio;
    ctx.fillText(`${J.textos.rival}:  ${brl(R.fat)} faturados · ${R.contratos} contratos · caixa ${brl(R.caixa)}`, 10, 30.5);
  });
  place(painel, 0, 2.2, 2.7);
  palco.add(painel);
}
function atualizarPainel() { if (painel) painel.userData.redraw(); }

// roleta do mercado -------------------------------------------------------------
function criarRoleta() {
  const g = new THREE.Group();
  const n = J.eventos.length;
  const disco = panel(0.62, 0.62, (ctx, W, H) => {
    const cx = W / 2, cy = H / 2, r = W / 2 - 1;
    J.eventos.forEach((ev, i) => {
      const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2 - Math.PI / n, a1 = a0 + (Math.PI * 2) / n;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
      ctx.fillStyle = i % 2 ? '#1d140d' : '#2b1a0e'; ctx.fill();
      ctx.lineWidth = 0.4; ctx.strokeStyle = ORG_CSS; ctx.stroke();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((a0 + a1) / 2);
      ctx.fillStyle = ev.cor; ctx.beginPath(); ctx.arc(r * 0.8, 0, 2.6, 0, 7); ctx.fill();
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, 7); ctx.fillStyle = COL.yellow; ctx.fill();
    ctx.fillStyle = COL.ink; ctx.font = `800 6px ${F_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GIRAR', cx, cy + 0.3);
  });
  g.add(disco);
  const seta = panel(0.1, 0.09, (ctx, W, H) => {
    ctx.beginPath(); ctx.moveTo(1, 1); ctx.lineTo(W - 1, 1); ctx.lineTo(W / 2, H - 1); ctx.closePath(); ctx.fillStyle = COL.yellow; ctx.fill();
  });
  seta.position.set(0, 0.35, 0.01);
  g.add(seta);
  const rot = panel(0.9, 0.16, (ctx, W, H, s) => {
    rich(ctx, s.t, 0, H / 2, W, 5.2, { weight: 700, align: 'center', valign: 'middle', lh: 1.2 });
  }, { t: J.textos.girar });
  rot.position.y = -0.43;
  g.add(rot);
  place(g, -25, 1.5, 2.2);
  palco.add(g);
  clicavel(disco, () => girar());
  disco.userData.hoverFn = h => { disco.scale.setScalar(1 + 0.04 * Math.min(h, 1)); };
  roleta = { g, disco, rot, girando: false, angulo: 0 };
}
const ORG_CSS = '#FF5F1F';
function girar() {
  if (est.fase !== 'roleta' || roleta.girando) return;
  roleta.girando = true;
  tocou();
  const n = J.eventos.length, idx = Math.floor(Math.random() * n);
  const passo = (Math.PI * 2) / n;
  // o segmento idx precisa parar sob a seta (topo)
  const final = roleta.angulo + Math.PI * 2 * 4 + ((idx * passo - roleta.angulo) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const ini = roleta.angulo;
  let ultimoSeg = -1;
  tw(2.6, k => {
    roleta.angulo = lerp(ini, final, k);
    roleta.disco.rotation.z = roleta.angulo;
    const seg = Math.floor(roleta.angulo / passo);
    if (seg !== ultimoSeg) { ultimoSeg = seg; sfx('tick', roleta.disco.getWorldPosition(v3)); }
  }, { ease: E.out, done: () => { roleta.girando = false; mostrarEvento(J.eventos[idx]); } });
}

// área central (evento, cartas, resultado) ----------------------------------------
function trocarArea(fn) {
  if (area) leave(area, 0.35);
  area = new THREE.Group();
  palco.add(area);
  fn(area);
}

// ================================================================== fluxo ===
function telaInicial() {
  est.fase = 'intro';
  if (painel) painel.visible = false;
  trocarArea(g => {
    const T = J.textos;
    const p = panel(2.0, 0.96, (ctx, W, H) => {
      cardBg(ctx, W, H, { r: 7 });
      eyebrow(ctx, T.eyebrow, 0, 9, W, { align: 'center' });
      let y = rich(ctx, T.titulo, 12, 18, W - 24, 10.5, { font: F_HEAD, weight: 700, align: 'center', lh: 1.1 });
      y += 5;
      T.regras.forEach((r, i) => {
        ctx.beginPath(); ctx.arc(20, y + 3.2, 3, 0, 7); ctx.fillStyle = COL.orange; ctx.fill();
        ctx.fillStyle = COL.ink; ctx.font = `800 3.6px ${F_HEAD}`; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), 20, y + 1.6); ctx.textAlign = 'left';
        y = rich(ctx, r, 28, y, W - 40, 5.4, { color: COL.text, lh: 1.35 }) + 3;
      });
      rich(ctx, T.aviso, 12, H - 8, W - 24, 3.8, { color: COL.mute, align: 'center', valign: 'bottom' });
    });
    place(p, 0, 1.5, 2.3);
    g.add(p);
    reveal(p, { owner: g });
    const b = botao(0.75, 0.2, T.comecar, () => comecarAno(), { primary: true });
    place(b, 0, 0.88, 2.2);
    g.add(b);
    reveal(b, { delay: 0.3, owner: g });
    guia.alvo(b, { avisar: false });
  });
  narrar('jogo_intro');
}
function comecarAno() {
  if (est.fase !== 'intro') return;
  pararNarracao();
  iniciarMes(0);
}
function iniciarMes(m) {
  est.mes = m;
  est.fase = 'roleta';
  painel.visible = true;
  est.evento = null;
  girarPalco(m);
  marcarCasa(m, 'atual');
  atualizarPainel();
  roleta.g.visible = true;
  roleta.rot.userData.state.t = J.textos.girar;
  roleta.rot.userData.redraw();
  trocarArea(g => {
    const p = panel(1.4, 0.3, (ctx, W, H) => {
      eyebrow(ctx, `Mês ${m + 1} de ${J.meses}`, 0, 2, W, { align: 'center' });
      rich(ctx, J.textos.girar, 0, 12, W, 9, { font: F_HEAD, weight: 700, align: 'center' });
    });
    place(p, 8, 1.6, 2.3);
    g.add(p);
    reveal(p, { owner: g });
  });
  guia.alvo(roleta.disco);
  if (m === 0) narrar('jogo_roleta');
  if (m === 6) narrar('jogo_meio');
}
function mostrarEvento(ev) {
  est.evento = ev;
  est.fase = 'decisao';
  sfx('chamado', roleta.disco.getWorldPosition(v3));
  roleta.rot.userData.state.t = ev.titulo;
  roleta.rot.userData.redraw();
  const opcoes = ofertas(est.mes);
  trocarArea(g => {
    const p = panel(1.6, 0.34, (ctx, W, H) => {
      eyebrow(ctx, 'Evento do mês', 0, 1, W, { align: 'center', color: ev.cor });
      rich(ctx, ev.titulo, 0, 10, W, 8.4, { font: F_HEAD, weight: 700, align: 'center', lh: 1.1 });
      rich(ctx, J.textos.escolher, 0, H - 6, W, 4.8, { color: COL.mute, align: 'center' });
    });
    place(p, 8, 1.78, 2.35);
    g.add(p);
    reveal(p, { owner: g });
    opcoes.forEach((c, i) => {
      const cor = { aquisicao: '#FF8A3D', comercial: '#FFD23F', produto: '#FFB020', e3: COL.yellow, nenhum: COL.frioMute }[c.pilar];
      const rotP = { aquisicao: 'Aquisição', comercial: 'Comercial', produto: 'Produto', e3: 'E3', nenhum: 'Sem investimento' }[c.pilar];
      const ca = card(0.6, 0.72, (ctx, W, H) => {
        cardBg(ctx, W, H, { r: 5, accent: cor, strong: c.pilar === 'e3' });
        ctx.font = `700 3.8px ${F_BODY}`; ctx.letterSpacing = '0.6px'; ctx.fillStyle = cor; ctx.fillText(rotP.toUpperCase(), 6, 6);
        ctx.letterSpacing = '0px';
        let y = rich(ctx, c.titulo, 6, 12, W - 12, 6.2, { font: F_HEAD, weight: 700, lh: 1.12 });
        y = rich(ctx, c.texto, 6, y + 2.5, W - 12, 4.2, { color: COL.mute, lh: 1.32 });
        const custo = c.mensal ? `${brl(c.mensal)} por mês` : c.custo ? `${brl(c.custo)} uma vez` : 'Sem custo';
        // efeito no rodapé; custo logo acima, sem sobrepor
        const hEf = rich(ctx, c.efeito, 6, 0, W - 12, 3.9, { lh: 1.25, dry: true });
        const yEf = H - 5 - hEf;
        ctx.fillStyle = COL.line; ctx.fillRect(6, yEf - 9, W - 12, 0.3);
        ctx.font = `700 4.2px ${F_BODY}`; ctx.fillStyle = COL.text; ctx.fillText(custo, 6, yEf - 6.5);
        rich(ctx, c.efeito, 6, yEf, W - 12, 3.9, { color: cor, weight: 600, lh: 1.25 });
      }, {}, () => decidir(c, ca));
      place(ca, 8 + (i - (opcoes.length - 1) / 2) * 17, 1.12, 2.15);
      g.add(ca);
      reveal(ca, { delay: 0.2 + i * 0.1, owner: g });
      if (i === 0) guia.alvo(ca);
    });
  });
  if (est.mes === 0) narrar('jogo_decisao');
}
function decidir(c, cartaMesh) {
  if (est.fase !== 'decisao') return;
  est.fase = 'resultado';
  escolher(c);
  const ev = est.evento, m = est.mes;
  const r = calcular(est.eu, ev, m), rr = calcular(est.rival, ev, m);
  aplicarMes(est.eu, r);
  aplicarMes(est.rival, rr);
  sfx(r.saldo >= 0 ? 'sucesso' : 'soltar', cartaMesh.getWorldPosition(v3));
  marcarCasa(m, r.saldo >= 0 ? 'feito' : 'ruim', `${r.contratos} contr.`);
  atualizarPainel();
  trocarArea(g => {
    const p = card(1.7, 0.66, (ctx, W, H, s) => {
      const k = s.k;
      cardBg(ctx, W, H, { r: 6, accent: r.saldo >= 0 ? COL.yellow : '#E0524B', strong: true });
      eyebrow(ctx, `Mês ${m + 1} · você escolheu: ${c.titulo}`, 10, 7, W - 20, { size: 3.8 });
      // você
      ctx.font = `700 4px ${F_BODY}`; ctx.fillStyle = COL.orange; ctx.fillText(J.textos.voce.toUpperCase(), 10, 15);
      ctx.font = `800 11px ${F_HEAD}`; ctx.fillStyle = COL.text;
      ctx.fillText(`${Math.round(r.contratos * k)} ${r.contratos === 1 ? 'contrato' : 'contratos'}`, 10, 20);
      ctx.font = `600 4.6px ${F_BODY}`; ctx.fillStyle = COL.text; ctx.fillText(`${brl(r.receita)} de receita`, 10, 34);
      ctx.fillStyle = r.saldo >= 0 ? COL.yellow : '#FF7A70'; ctx.fillText(`Saldo do mês: ${brl(r.saldo)}`, 10, 40);
      // rival
      const x2 = W * 0.58;
      ctx.font = `700 4px ${F_BODY}`; ctx.fillStyle = COL.frio; ctx.fillText(J.textos.rival.toUpperCase(), x2, 15);
      ctx.font = `800 11px ${F_HEAD}`; ctx.fillStyle = '#C9D5E0';
      ctx.fillText(`${Math.round(rr.contratos * k)} ${rr.contratos === 1 ? 'contrato' : 'contratos'}`, x2, 20);
      ctx.font = `600 4.6px ${F_BODY}`; ctx.fillStyle = COL.frio; ctx.fillText(`${brl(rr.receita)} de receita`, x2, 34);
      ctx.fillText(`Saldo do mês: ${brl(rr.saldo)}`, x2, 40);
      // notas do evento
      let y = 49;
      for (const n of r.notas) {
        ctx.fillStyle = n.bom === true ? COL.yellow : n.bom === false ? '#FF7A70' : COL.mute;
        ctx.beginPath(); ctx.arc(12, y + 2.4, 1.2, 0, 7); ctx.fill();
        y = rich(ctx, n.t, 16, y, W - 26, 4.8, { color: COL.text, lh: 1.3 }) + 1.5;
      }
    }, { k: 0 });
    place(p, 8, 1.42, 2.25);
    g.add(p);
    reveal(p, { owner: g });
    const pm = p.userData.mesh;
    tw(1.2, k => { pm.userData.state.k = k; pm.userData.redraw(); }, { delay: 0.3, owner: g });
    const ultimo = m === J.meses - 1;
    const b = botao(0.7, 0.18, ultimo ? J.textos.final : J.textos.proximo, () => (ultimo ? fimDoAno() : iniciarMes(m + 1)), { primary: true });
    place(b, 8, 0.92, 2.15);
    g.add(b);
    reveal(b, { delay: 0.8, owner: g });
    tw(1.6, () => {}, { owner: g, done: () => guia.alvo(b) });
  });
  if (m < J.meses - 1) moverPeoes(m + 1);
  girarNucleo();
  tocou();
}

// ================================================================= final ===
let resultadoFinal = null;
function diagnosticar() {
  const P = est.eu;
  const pts = { aquisicao: 0, comercial: 0, produto: 0 };
  for (const id of P.tomou) {
    const c = carta(id);
    if (c.pilar === 'e3') { pts.aquisicao += 2; pts.comercial += 2; pts.produto += 2; }
    else if (pts[c.pilar] !== undefined) pts[c.pilar]++;
  }
  const fraco = Object.keys(pts).sort((a, b) => pts[a] - pts[b])[0];
  const d = P.tomou.has('e3') && pts[fraco] >= 2 ? J.diagnostico.completo : J.diagnostico[fraco];
  const prog = K.programas.find(p => p.id === d.programa);
  const razao = est.rival.fat > 0 ? P.fat / est.rival.fat : 0;
  const perfil = razao >= 4 ? 'Escritório escalável' : razao >= 2 ? 'Escritório em crescimento' : P.esperas >= 6 ? 'Escritório à espera' : 'Escritório em construção';
  return { pts, fraco, d, prog, razao, perfil };
}
function fimDoAno() {
  est.fase = 'fim';
  const R = diagnosticar();
  resultadoFinal = R;
  roleta.g.visible = false;
  painel.visible = false;
  girarPalco(J.meses - 1 + 0.0001, 1);
  sfx('acender', camera.getWorldPosition(v3));
  narrar('jogo_fim');
  avisarCloser(R);
  trocarArea(g => {
    const P = est.eu, Rv = est.rival;
    const p = card(2.2, 1.08, (ctx, W, H, s) => {
      const k = s.k;
      cardBg(ctx, W, H, { r: 7, accent: COL.yellow, strong: true });
      eyebrow(ctx, `Fim do ano · código ${est.codigo}`, 12, 9, W - 24);
      rich(ctx, `*${R.perfil}*`, 12, 17, W - 24, 13, { font: F_HEAD, weight: 800, hi: COL.text });
      // barras de faturamento
      const mx = Math.max(P.fat, Rv.fat, 1), bw = W * 0.36;
      const barra = (y, rot, v, cor, txtCor) => {
        ctx.font = `700 4px ${F_BODY}`; ctx.fillStyle = txtCor; ctx.fillText(rot.toUpperCase(), 12, y);
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(12, y + 6, bw, 6);
        ctx.fillStyle = cor; ctx.fillRect(12, y + 6, bw * (v / mx) * k, 6);
        ctx.font = `800 6.5px ${F_HEAD}`; ctx.fillStyle = COL.text; ctx.fillText(brl(v * k), 16 + bw, y + 5.5);
      };
      barra(36, `${J.textos.voce} · ${P.contratos} contratos`, P.fat, COL.orange, COL.orange);
      barra(54, `${J.textos.rival} · ${Rv.contratos} contratos`, Rv.fat, '#5F7080', COL.frio);
      // diagnóstico
      const x = W * 0.72;
      ctx.fillStyle = COL.line; ctx.fillRect(x - 6, 34, 0.3, 40);
      ctx.font = `700 4px ${F_BODY}`; ctx.fillStyle = COL.yellow; ctx.fillText('PILAR A REFORÇAR', x, 36);
      let y = rich(ctx, R.d.pilar, x, 42, W - x - 12, 8, { font: F_HEAD, weight: 700 });
      y = rich(ctx, R.d.texto, x, y + 2, W - x - 12, 4.2, { color: COL.mute, lh: 1.3 });
      if (R.prog) { ctx.font = `700 4px ${F_BODY}`; ctx.fillStyle = COL.orange; ctx.fillText('PROGRAMA SUGERIDO', x, y + 4); rich(ctx, R.prog.nome, x, y + 10, W - x - 12, 5.6, { weight: 700 }); }
      rich(ctx, J.textos.aviso, 12, H - 6, W - 24, 3.6, { color: COL.mute, valign: 'bottom' });
    }, { k: 0 });
    place(p, 0, 1.55, 2.3);
    g.add(p);
    reveal(p, { owner: g });
    const pm = p.userData.mesh;
    tw(2, k => { pm.userData.state.k = k; pm.userData.redraw(); }, { delay: 0.5, owner: g });
    const b = botao(0.8, 0.2, J.textos.contato, () => irParaContato(), { primary: true });
    place(b, -8, 0.92, 2.2);
    const nova = botao(0.55, 0.2, J.textos.jogarDeNovo, () => reiniciar());
    place(nova, 10, 0.92, 2.2);
    g.add(b, nova);
    reveal(b, { delay: 1, owner: g });
    reveal(nova, { delay: 1.1, owner: g });
    tw(2.5, () => {}, { owner: g, done: () => guia.alvo(b) });
    confete(g);
  });
}
function confete(g) {
  const ps = Array.from({ length: 50 }, (_, i) => {
    const s = glow(0.08 + Math.random() * 0.1, i % 3 ? ORG : YEL);
    const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 2;
    s.userData.to = new THREE.Vector3(Math.cos(a) * r, 1.6 + Math.sin(a) * r * 0.6, -2.3 - Math.random());
    g.add(s);
    return s;
  });
  const de = new THREE.Vector3(0, 1.55, -2.3);
  tw(2.4, k => ps.forEach(s => { s.position.lerpVectors(de, s.userData.to, k); op(s, Math.sin(k * Math.PI) * 0.9); }), { ease: E.expo, owner: g });
}

// aviso ao closer (sem nenhum dado pessoal) -------------------------------------
async function avisarCloser(R) {
  const corpo = `${ESTACAO}: o cliente terminou o ${J.nome}. Código ${est.codigo}.\n` +
    `Perfil: ${R.perfil}. Pilar a reforçar: ${R.d.pilar}.` + (R.prog ? `\nPrograma sugerido: ${R.prog.nome}.` : '') +
    `\nFaturamento no jogo: ${brl(est.eu.fat)} (sem método: ${brl(est.rival.fat)}).`;
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(CONFIG.ntfyTopico)}`, {
      method: 'POST', body: corpo, headers: { Title: 'E3 VR - Jogo concluido', Tags: 'video_game', Priority: 'high' },
    });
  } catch (e) { /* sem internet: o closer vê pelo espelhamento */ }
}

// sai do óculos e abre o formulário no navegador ---------------------------------
async function irParaContato() {
  const s = renderer.xr.getSession();
  if (s) { try { await s.end(); } catch (e) { /* já saiu */ } }
  mostrarFormulario();
}

// ============================================================== tela (DOM) ===
const $ = id => document.getElementById(id);
function mostrar(id) { ['inicio', 'contato', 'resumo'].forEach(x => $(x).classList.toggle('off', x !== id)); }
function esconderTudo() { ['inicio', 'contato', 'resumo'].forEach(x => $(x).classList.add('off')); $('hud').classList.remove('off'); S.iniciou = true; }
function mostrarFormulario() {
  $('hud').classList.add('off');
  const R = resultadoFinal;
  $('formResumo').textContent = R ? `${R.perfil} · pilar a reforçar: ${R.d.pilar}` : '';
  mostrar('contato');
  setTimeout(() => $('nome').focus(), 100);
}
$('formContato').addEventListener('submit', e => {
  e.preventDefault();
  const nome = $('nome').value.trim(), whats = $('whats').value.trim(), escr = $('escritorio').value.trim();
  if (!nome || whats.replace(/\D/g, '').length < 10 || !$('lgpd').checked) { $('formErro').textContent = 'Preencha nome, WhatsApp com DDD e o aceite.'; return; }
  $('formErro').textContent = '';
  const R = resultadoFinal, P = est.eu;
  const linhas = [
    ['Código', est.codigo], ['Nome', nome], ['WhatsApp', whats], ['Escritório / área', escr || '—'],
    ['Perfil no jogo', R ? R.perfil : '—'], ['Pilar a reforçar', R ? R.d.pilar : '—'], ['Programa sugerido', R && R.prog ? R.prog.nome : '—'],
    ['Faturamento no jogo', `${brl(P.fat)} (sem método: ${brl(est.rival.fat)})`], ['Contratos no jogo', `${P.contratos} (sem método: ${est.rival.contratos})`],
    ['Aceite LGPD', 'Sim, ' + new Date().toLocaleString('pt-BR')],
  ];
  const tb = $('resumoTabela');
  tb.innerHTML = '';
  for (const [k, v] of linhas) {
    const tr = document.createElement('tr');
    const th = document.createElement('th'); th.textContent = k;
    const td = document.createElement('td'); td.textContent = v;
    tr.append(th, td);
    tb.appendChild(tr);
  }
  mostrar('resumo');
  // nada é salvo nem enviado: o closer anota no tablet
  fetch(`https://ntfy.sh/${encodeURIComponent(CONFIG.ntfyTopico)}`, { method: 'POST', body: `${ESTACAO}: o cliente do código ${est.codigo} preencheu o contato. Anote pelo espelhamento.`, headers: { Title: 'E3 VR - Contato preenchido', Tags: 'memo' } }).catch(() => {});
});
$('novaPartida').addEventListener('click', () => { $('formContato').reset(); reiniciar(); mostrar('inicio'); });

// ================================================================ sessão ===
function alinhar() { world.rotation.y = yawCabeca(); palco.rotation.y = 0; world.updateMatrixWorld(true); }
function reiniciar() {
  pararNarracao();
  est = novoEstado();
  resultadoFinal = null;
  casas.forEach((c, m) => marcarCasa(m, 'futuro', ''));
  moverPeoes(0, true);
  palco.rotation.y = 0;
  roleta.g.visible = false;
  roleta.angulo = 0; roleta.disco.rotation.z = 0;
  atualizarPainel();
  telaInicial();
  tocou();
}
async function entrar() {
  iniciarAudio();
  const xr = navigator.xr;
  if (temXR) {
    const modo = (await xr.isSessionSupported('immersive-ar').catch(() => false)) ? 'immersive-ar' : 'immersive-vr';
    try {
      const session = await xr.requestSession(modo, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      await renderer.xr.setSession(session);
      esconderTudo();
      setTimeout(() => { alinhar(); comecarCenario(); }, 400);
    } catch (err) { $('status').textContent = 'Não foi possível entrar no modo imersivo: ' + (err && err.message ? err.message : err); }
  } else {
    esconderTudo();
    alinhar();
    comecarCenario();
  }
}
function comecarCenario() {
  setHumor('luz', 2);
  tw(1.6, k => { setProg(k); setLuz(k); }, { ease: E.inOut });
  reiniciar();
}
renderer.xr.addEventListener('sessionend', () => {
  view.yaw = view.pitch = view.tyaw = view.tpitch = 0;
  camera.position.set(0, 1.6, 0);
  if (est && est.fase !== 'fim') { mostrar('inicio'); $('hud').classList.add('off'); }
});
let temXR = false;
$('jogar').addEventListener('click', entrar);
$('resetHud').addEventListener('click', () => reiniciar());
if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then(ok => {
    temXR = ok;
    $('status').textContent = ok ? 'Óculos detectado.' : 'Modo tela, para ensaio. No Quest, este mesmo botão abre o jogo em 3D.';
  }).catch(() => {});
} else $('status').textContent = 'Modo tela, para ensaio. No Quest, este mesmo botão abre o jogo em 3D.';
try { const v = localStorage.getItem('e3vr-narracao'); if (v !== null) setNarracaoAtiva(v === '1'); } catch (e) { /* sem storage */ }

// atalho do closer: segurar B ou Y por 2 s reinicia
let segura = 0;
function checarReset(dt) {
  if (!renderer.xr.isPresenting) { segura = 0; return; }
  const ap = renderer.xr.getSession() && [...renderer.xr.getSession().inputSources].some(s => s.gamepad && s.gamepad.buttons[5] && s.gamepad.buttons[5].pressed);
  segura = ap ? segura + dt : 0;
  if (segura > 2) { segura = 0; reiniciar(); }
}
window.addEventListener('keydown', e => {
  if (!S.iniciou) return;
  const k = e.key.toLowerCase();
  if (k === 'r') reiniciar();
  if (k === ' ' || k === 'arrowright') {
    if (est.fase === 'intro') comecarAno();
    else if (est.fase === 'roleta') girar();
  }
});

// ------------------------------------------------------------------- loop ---
const clock = new THREE.Clock();
let ultimoPalco = null;
function sim(dt) {
  S.T += dt;
  updateTweens(dt);
  updateUpdaters(dt);
  updateAmbiente(S.T, dt);
  updateGuia(dt);
  updatePointers(dt);
  updateCameraTela(dt);
  updateAudio();
  checarReset(dt);
  if (peao) peao.rotation.y += dt * 1.2;
  if (est && est.fase !== 'intro' && est.fase !== 'fim' && S.T - S.lastInput > CONFIG.ociosoSegundos) reiniciar();
  // em tela, a câmera acompanha o palco
  if (!renderer.xr.isPresenting && est && palco.rotation.y !== ultimoPalco) { ultimoPalco = palco.rotation.y; view.tyaw = palco.rotation.y + world.rotation.y; }
}
function frame() { sim(Math.min(clock.getDelta(), 0.05)); renderer.render(scene, camera); }

async function boot() {
  const fontes = ['700 20px "Archivo"', '800 20px "Archivo"', '500 20px "Plus Jakarta Sans"', '600 20px "Plus Jakarta Sans"', '700 20px "Plus Jakarta Sans"'];
  await Promise.race([Promise.all(fontes.map(f => document.fonts.load(f))).catch(() => {}), new Promise(r => setTimeout(r, 2500))]);
  await carregarLogo();
  est = novoEstado();
  criarTabuleiro();
  criarPainel();
  criarRoleta();
  roleta.g.visible = false;
  criarGuia();
  renderer.setAnimationLoop(frame);
  const avancarTempo = s => { for (let i = 0; i < s * 30; i++) sim(1 / 30); renderer.render(scene, camera); };
  window.__jogo = { get est() { return est; }, entrar, girar, comecarAno, decidir: i => { const ops = ofertas(est.mes); decidir(ops[i], area); }, ofertas: () => ofertas(est.mes).map(c => c.id), proximo: () => { if (est.fase === 'resultado') (est.mes < J.meses - 1 ? iniciarMes(est.mes + 1) : fimDoAno()); }, avancarTempo, reiniciar, fimDoAno, mostrarFormulario, view };
}
boot();
