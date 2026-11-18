// =============================================================================
// Jogo do Crescimento E3 · VR (roteiro "Jornada do escritório ao milhão")
// 8 decisões, 4 fases, 32 casas, carta surpresa após Q6, 6 finais.
// Regras em logica.js, textos em jogo-dados.js, falas em narracao.js.
// O visitante fica parado; tudo acontece num arco à frente (−45° a +45°).
// =============================================================================
import {
  THREE, DEG, ORG, YEL, COL, F_HEAD, F_BODY, S, hooks, tocou, renderer, scene, camera, world, FRENTE,
  panel, rich, eyebrow, cardBg, pill, card, botao, setLabel, place, glow, tw, E, reveal, leave, kill, setAlpha, op,
  clamp, lerp, updateTweens, updateUpdaters, updatePointers, updateCameraTela, yawCabeca, view, addUpdater, clicavel,
} from './motor.js';
import { iniciarAudio, setHumor, sfx, narrar, pararNarracao, updateAudio, setNarracaoAtiva, audio, setVolume, volume, duracaoFala, somEspacialVideo, duckVideo, setEnergia, suspenderAudio } from './audio.js';
import { amb, setProg, setLuz, updateAmbiente, carregarLogo, girarNucleo, frio, partesFrio, flashLuz } from './ambiente.js';
import { criarGuia, guia, updateGuia } from './guia.js';
import { JOGO as J, CONFIG_VERSAO } from './jogo-dados.js';
import * as L from './logica.js';
import { NARRACAO, LEGENDA } from './narracao.js';
import { CONFIG } from './conteudo.js';
import { tab, criarTabuleiro, posicionar, andar, virarCarta } from './tabuleiro.js';

const params = new URLSearchParams(location.search);
const ESTACAO = params.get('estacao') ? `Estação ${params.get('estacao')}` : CONFIG.estacaoPadrao;
const v3 = new THREE.Vector3();
const CHAVE_SESSAO = 'e3jogo-sessao', CHAVE_METRICAS = 'e3jogo-metricas', CHAVE_ULTIMO = 'e3jogo-ultimo';
const LUZ_FASE = [0, 0.3, 0.6, 0.85];
const ANG = [-45, -15, 15, 45];          // arco frontal das alternativas
renderer.setClearColor(0x2b2e33, 1);
hooks.clique = m => sfx('clique', m.getWorldPosition(v3));
hooks.hover = () => sfx('hover');

let s = null;                // sessão atual (estado mínimo do roteiro)
let etapa = 'inicial';       // inicial | abertura | treino | pergunta | confirmar | feedback | transicao | evento | resultado | fim | pausa
let palco = null;            // grupo da etapa atual
let pausado = false, etapaAntesPausa = null, avisouInatividade = false, avisouOperador = false;
let faseVisivel = -1;

// ================================================================ métricas ===
function registrar(ev, extra = {}) {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE_METRICAS) || '[]');
    lista.push({ t: new Date().toISOString(), ev, session_id: s ? s.session_id : null, config: CONFIG_VERSAO, estacao: ESTACAO, ...extra });
    if (lista.length > 20000) lista.splice(0, lista.length - 20000);
    localStorage.setItem(CHAVE_METRICAS, JSON.stringify(lista));
  } catch (e) { /* sem armazenamento: segue o jogo */ }
}
function salvar() {
  try { if (s) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)); } catch (e) { /* sem armazenamento */ }
}
function sessaoSalva() {
  try {
    const x = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null');
    if (!x || x.status !== 'em_andamento' || x.config_version !== CONFIG_VERSAO) return null;
    if (Date.now() - new Date(x.started_at).getTime() > 30 * 60 * 1000) return null;
    return x;
  } catch (e) { return null; }
}
function limparSessao() { try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* nada */ } }

// ============================================================= aviso closer ===
async function avisar(titulo, corpo, prioridade = 'default') {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(`https://ntfy.sh/${encodeURIComponent(CONFIG.ntfyTopico)}`, { method: 'POST', body: corpo, signal: ctrl.signal, headers: { Title: titulo, Priority: prioridade, Tags: 'video_game' } });
    return r.ok;
  } catch (e) { return false; } finally { clearTimeout(t); }
}

// ================================================================= legenda ===
const legenda = panel(1.3, 0.2, (ctx, W, H, st) => {
  if (!st.t) return;
  const h = rich(ctx, st.t, 0, 0, W - 12, 4.6, { lh: 1.32, dry: true });
  const y0 = H - h - 4;
  ctx.beginPath(); ctx.roundRect(0, y0 - 3, W, h + 6, 3); ctx.fillStyle = 'rgba(8,6,4,0.82)'; ctx.fill();
  rich(ctx, st.t, 6, y0, W - 12, 4.6, { lh: 1.32, align: 'center', color: COL.text });
}, { t: '' });
legenda.material.depthTest = false;
legenda.renderOrder = 40;
scene.add(legenda);
let legendaAte = 0;
function mostrarLegenda(t, dur) {
  legenda.userData.state.t = t;
  legenda.userData.redraw();
  legendaAte = S.T + dur;
}
function atualizarLegenda(dt) {
  if (legendaAte && S.T > legendaAte) { legendaAte = 0; legenda.userData.state.t = ''; legenda.userData.redraw(); }
  camera.getWorldPosition(v3);
  const fw = new THREE.Vector3(); camera.getWorldDirection(fw); fw.y = 0; fw.normalize();
  const alvo = v3.clone().addScaledVector(fw, 1.45); alvo.y = v3.y - 0.6;
  legenda.position.lerp(alvo, 1 - Math.exp(-dt * 3));
  legenda.lookAt(v3.x, legenda.position.y, v3.z);
}

// fala uma sequência de trechos, com legenda; chama fim() ao terminar
let tokenFala = 0;
function falar(chaves, fim) {
  const meu = ++tokenFala;
  const lista = [].concat(chaves).filter(Boolean);
  const proximo = i => {
    if (meu !== tokenFala) return;
    if (i >= lista.length) { if (fim) fim(); return; }
    const k = lista[i];
    const texto = LEGENDA[k] || NARRACAO[k] || '';
    const dur = duracaoFala(k) || Math.max(2, texto.split(/\s+/).length / 2.6);
    // perguntas, treino e avisos finais já aparecem escritos no painel: sem legenda duplicada
    if (!/^Q\d$/.test(k) && !['treino', 'antes_video', 'apos_cta'].includes(k)) mostrarLegenda(texto, dur + 0.3);
    // segue quando a fala termina; se o áudio travar (contexto suspenso), segue pelo tempo estimado
    let feito = false;
    const avancar = () => { if (!feito) { feito = true; proximo(i + 1); } };
    if (audio.narracaoAtiva && audio.pronto && duracaoFala(k)) narrar(k, avancar);
    tw(audio.narracaoAtiva && duracaoFala(k) ? dur + 1.5 : dur, () => {}, { done: avancar, ease: E.lin });
  };
  proximo(0);
}
function calarFala() { tokenFala++; pararNarracao(); legendaAte = S.T; }

// ============================================================== escritório ===
// O escritório escuro da apresentação vem para a frente e evolui a cada fase.
FRENTE.add(frio);
partesFrio.pessoa.forEach(m => { m.visible = false; });
partesFrio.titulo.visible = false;
partesFrio.palavras.forEach(p => { p.visible = false; });
partesFrio.agenda.visible = false;
partesFrio.grafico.visible = false;
partesFrio.pontoQueda.visible = false;
const decor = [new THREE.Group(), new THREE.Group(), new THREE.Group(), new THREE.Group()];
decor.forEach(g => { g.visible = false; FRENTE.add(g); });

function painelDecor(w, h, desenho, estado) {
  return panel(w, h, (ctx, W, H, st) => { cardBg(ctx, W, H, { r: 4, fill: 'rgba(14,11,8,0.9)' }); desenho(ctx, W, H, st); }, estado);
}
function criarDecor() {
  // Início: papéis sobre a mesa
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), new THREE.MeshBasicMaterial({ color: 0xd9d4cc, transparent: true, opacity: 0.85 }));
    p.rotation.x = -Math.PI / 2; p.rotation.z = 0.2 * (i - 1);
    p.position.set(0.15 + i * 0.05, 0.79 + i * 0.002, -3.6 - i * 0.03);
    decor[0].add(p);
  }
  // Estruturação: CRM (funil de contatos) e tarefas
  const crm = painelDecor(1.3, 0.8, (ctx, W, H) => {
    eyebrow(ctx, 'Contatos · CRM', 6, 5, W, { size: 4 });
    ['Novo', 'Atendimento', 'Proposta', 'Contrato'].forEach((c, i) => {
      const x = 6 + i * (W - 12) / 4;
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x + 1, 16, (W - 12) / 4 - 2, H - 22);
      ctx.font = `700 3.6px ${F_BODY}`; ctx.fillStyle = COL.mute; ctx.fillText(c.toUpperCase(), x + 3, 18);
    });
  });
  place(crm, -27, 1.9, 4.6);
  decor[1].add(crm);
  const pontos = Array.from({ length: 8 }, () => { const d = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ color: ORG, transparent: true })); d.renderOrder = 1; crm.add(d); return d; });
  addUpdater(decor[1], t => pontos.forEach((d, j) => {
    const u = (t * 0.18 + j * 0.37) % 4, col = Math.min(3, Math.floor(u));
    d.position.set(-0.49 + col * 0.31 + E.inOut(clamp((u - col) * 2, 0, 1)) * (col < 3 ? 0.31 : 0) - 0.0, 0.18 - (j % 4) * 0.13, 0.01);
    d.material.color.set(col >= 3 ? YEL : ORG);
  }));
  const tarefas = painelDecor(1.2, 0.8, (ctx, W, H, st) => {
    eyebrow(ctx, 'Tarefas da semana', 6, 5, W, { size: 4 });
    ['Responder contatos novos', 'Enviar propostas', 'Follow-up de 48 h', 'Reunião de indicadores'].forEach((t, i) => {
      const y = 18 + i * 13, feito = i < st.n;
      ctx.strokeStyle = feito ? COL.yellow : COL.mute; ctx.lineWidth = 0.5; ctx.strokeRect(7, y, 5, 5);
      if (feito) { ctx.beginPath(); ctx.moveTo(8, y + 2.6); ctx.lineTo(9.6, y + 4.2); ctx.lineTo(11.4, y + 1); ctx.stroke(); }
      ctx.font = `600 4.6px ${F_BODY}`; ctx.fillStyle = feito ? COL.text : COL.mute; ctx.fillText(t, 15, y);
    });
  }, { n: 0 });
  place(tarefas, 27, 1.9, 4.6);
  decor[1].add(tarefas);
  addUpdater(decor[1], t => { const n = Math.floor(t / 1.6) % 5; if (n !== tarefas.userData.state.n) { tarefas.userData.state.n = n; tarefas.userData.redraw(); } });
  // Aceleração: painel de demanda e equipe em atividade
  const demanda = painelDecor(1.1, 0.7, (ctx, W) => eyebrow(ctx, 'Demanda por canal', 6, 5, W, { size: 4 }));
  place(demanda, -52, 1.55, 4.0);
  decor[2].add(demanda);
  const barras = [0, 1, 2, 3, 4].map(i => { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1), new THREE.MeshBasicMaterial({ color: i === 4 ? YEL : ORG, transparent: true })); b.geometry.translate(0, 0.5, 0); b.position.set(-0.36 + i * 0.18, -0.27, 0.01); b.renderOrder = 1; demanda.add(b); return b; });
  addUpdater(decor[2], t => barras.forEach((b, i) => { b.scale.y = 0.12 + 0.07 * i + 0.04 * Math.sin(t * 1.8 + i); }));
  const matEquipe = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, emissive: ORG, emissiveIntensity: 0.15, roughness: 0.7, transparent: true });
  [44, 54, 64].forEach((a, i) => {
    const g = new THREE.Group(); place(g, a, 0, 4.2);
    const mesa = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.4), matEquipe); mesa.position.set(0, 0.74, 0.25);
    const corpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.35, 4, 10), matEquipe); corpo.position.set(0, 0.95, -0.1);
    const cab = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), matEquipe); cab.position.set(0, 1.32, -0.05);
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.85 }));
    tela.position.set(0, 0.92, 0.36); tela.rotation.y = Math.PI;
    g.add(mesa, corpo, cab, tela); decor[2].add(g);
    addUpdater(decor[2], t => { cab.position.y = 1.32 + Math.sin(t * 2 + i) * 0.01; op(tela, 0.7 + 0.2 * Math.sin(t * 3 + i)); });
  });
  // Escala: visão gerencial com indicadores consolidados
  const kpi = painelDecor(2.6, 0.62, (ctx, W, H, st) => {
    eyebrow(ctx, 'Visão gerencial', 0, 5, W, { align: 'center', size: 4.4 });
    const ks = [['Fase', 'Escala'], ['Casa', `${st.casa} de 32`], ['Faturamento simulado', st.valor], ['Decisões', `${st.dec} de 8`]];
    ks.forEach(([r, v], i) => {
      const x = 8 + i * (W - 16) / 4;
      ctx.font = `700 3.8px ${F_BODY}`; ctx.fillStyle = COL.mute; ctx.fillText(r.toUpperCase(), x, 20);
      ctx.font = `800 9px ${F_HEAD}`; ctx.fillStyle = i === 2 ? COL.yellow : COL.text; ctx.fillText(v, x, 27);
    });
  }, { casa: 0, valor: 'R$ 0', dec: 0 });
  place(kpi, 0, 3.15, 5.0);
  decor[3].add(kpi);
  decor[3].userData.kpi = kpi;
}
function mostrarFase(f, animar = true) {
  if (f <= faseVisivel) return;
  for (let i = faseVisivel + 1; i <= f; i++) {
    decor[i].visible = true;
    if (animar) { reveal(decor[i], { dy: 0.3, dur: 1.4, escala: false }); }
  }
  faseVisivel = f;
  const l0 = amb.luz, l1 = LUZ_FASE[f];
  tw(animar ? 2.2 : 0.01, k => setLuz(lerp(l0, l1, k)), { ease: E.inOut });
  partesFrio.lampada.color.set(f === 0 ? 0x9fc3ff : 0xffc08a);
  partesFrio.cupula.material.color.set(f === 0 ? 0x9fc3ff : 0xffc08a);
  partesFrio.halo.material.color.set(f === 0 ? 0x9fc3ff : 0xffc08a);
  if (animar && f > 0) { sfx('acender', frio.getWorldPosition(v3)); girarNucleo(); }
  // a trilha animada cresce junto com o escritório: uma camada a mais por fase
  setEnergia(f + 1);
  setHumor('luz', 2.5);
}
function resetarFases() {
  decor.forEach(g => { g.visible = false; });
  faseVisivel = -1;
}

// ===================================================================== HUD ===
const hud = panel(2.3, 0.3, (ctx, W, H, st) => {
  cardBg(ctx, W, H, { r: 5 });
  const fase = J.fases[st.fase] || J.fases[0];
  const cols = [['Fase', `${fase.nome}`], ['Decisão', `${st.dec} de 8`], ['Casa', `${st.casa} de 32`], ['Faturamento simulado', `${st.valor}/mês`]];
  const cw = (W - 16) / 4;
  cols.forEach(([r, v], i) => {
    const x = 8 + i * cw;
    ctx.font = `700 3.6px ${F_BODY}`; ctx.letterSpacing = '0.5px'; ctx.fillStyle = COL.mute; ctx.fillText(r.toUpperCase(), x, 4.5);
    ctx.letterSpacing = '0px';
    ctx.font = `800 7.2px ${F_HEAD}`; ctx.fillStyle = i === 3 ? COL.yellow : COL.text; ctx.fillText(v, x, 9.5);
  });
  // trilha das 32 casas
  const x0 = 8, x1 = W - 8, y = 22.5, n = 32, g = 0.5, w = (x1 - x0 - g * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const cheio = i < st.casaVis;
    ctx.fillStyle = cheio ? (i >= 31 ? COL.yellow : COL.orange) : 'rgba(255,255,255,0.12)';
    ctx.fillRect(x0 + i * (w + g), y, w, 2.4);
  }
  const px = x0 + clamp(st.casaVis, 0, 32) * (w + g) - g / 2;
  ctx.beginPath(); ctx.arc(px, y + 1.2, 2.1, 0, 7); ctx.fillStyle = COL.yellow; ctx.fill();
  ctx.lineWidth = 0.5; ctx.strokeStyle = COL.ink; ctx.stroke();
}, { fase: 0, dec: 0, casa: 0, casaVis: 0, valor: 'R$ 0' });
place(hud, 0, 2.38, 2.6);
FRENTE.add(hud);
hud.visible = false;
function atualizarHud(animar = true) {
  const st = hud.userData.state;
  const dec = Object.keys(s.answers).length;
  // durante a carta surpresa a fase ainda é Aceleração
  const qFase = s.question_index === 6 && !L.eventoResolvido(s) ? 6 : Math.min(8, s.question_index + 1);
  const fase = J.fases.findIndex(f => f.id === (L.pergunta(`Q${qFase}`) || {}).fase);
  st.fase = Math.max(0, fase);
  st.dec = Math.min(8, dec + (etapa === 'pergunta' || etapa === 'confirmar' ? 1 : 0));
  st.casa = s.current_house;
  st.valor = L.receita(s.current_house).texto;
  const de = st.casaVis, para = s.current_house;
  if (animar && de !== para) tw(Math.min(1.6, 0.25 * Math.abs(para - de) + 0.3), k => { st.casaVis = lerp(de, para, k); hud.userData.redraw(); }, { ease: E.inOut });
  else { st.casaVis = para; }
  hud.userData.redraw();
  const kpi = decor[3].userData.kpi;
  if (kpi) { Object.assign(kpi.userData.state, { casa: s.current_house, valor: L.receita(s.current_house).texto, dec }); kpi.userData.redraw(); }
}

// ============================================================ ferramentas ===
// Console baixo: pausar, recalibrar e sair (o roteiro pede os três sempre à mão)
const consoleG = new THREE.Group();
consoleG.position.set(-1.25, 0.9, -0.75);   // ao lado do tabuleiro, fora do arco das opções
consoleG.rotation.y = 1.0;
FRENTE.add(consoleG);
const bPausa = botao(0.38, 0.12, '❚❚ Pausar', () => pausar());
const bRecal = botao(0.42, 0.12, '⟳ Recalibrar', () => recalibrar());
const bSair = botao(0.34, 0.12, '✕ Sair', () => pedirSaida());
bPausa.position.y = 0.16; bSair.position.y = -0.16;
consoleG.add(bPausa, bRecal, bSair);
consoleG.visible = false;

// FECHAR: fecha tudo de verdade (sai do modo imersivo, para som, vídeos e a cena).
// Pede um segundo toque. "Abrir de novo" recarrega a página do zero.
let fechaAte = 0, fechado = false;
const botoesFechar = [];
function criarFechar(w = 0.4, h = 0.12) {
  const b = card(w, h, (ctx, W, H, st) => pill(ctx, W, H, st.label, { fill: st.confirma ? '#E0524B' : 'rgba(20,16,12,0.92)', stroke: '#E0524B', color: COL.text, size: H * 0.36 }),
    { label: '✕ FECHAR', confirma: false }, () => pedirFechar());
  botoesFechar.push(b);
  return b;
}
function rotularFechar(confirma) {
  botoesFechar.forEach(b => {
    const st = b.userData.mesh.userData.state;
    if (st.confirma === confirma) return;
    st.confirma = confirma; st.label = confirma ? 'Toque de novo' : '✕ FECHAR';
    b.userData.mesh.userData.redraw();
  });
}
function pedirFechar() {
  if (S.T < fechaAte) { fechaAte = 0; rotularFechar(false); fecharTudo(); return; }
  fechaAte = S.T + 3;
  rotularFechar(true);
  tw(3.05, () => {}, { ease: E.lin, done: () => { if (S.T >= fechaAte) rotularFechar(false); } });
}
async function fecharTudo() {
  if (fechado) return;
  fechado = true;
  if (s && s.status === 'em_andamento') { s.status = 'abandonada'; registrar('session_abandoned', { motivo: 'fechar', question_index: s.question_index }); }
  limparSessao();
  calarFala();
  [videoProva, videoReel].forEach(v => v && v.pause());
  videoProva = videoReel = null;
  duckVideo(false);
  setHumor('nenhum', 0.2);
  const sessao = renderer.xr.getSession();
  if (sessao) await sessao.end().catch(() => {});
  renderer.setAnimationLoop(null);
  suspenderAudio();
  ['inicio', 'resumo', 'hud'].forEach(id => $(id) && $(id).classList.add('off'));
  $('fechado').classList.remove('off');
  try { window.close(); } catch (e) { /* o navegador pode não deixar fechar a aba */ }
}
const bFechar = criarFechar();
bFechar.position.y = -0.32;
consoleG.add(bFechar);

// ================================================================= etapas ===
function trocar(fn) {
  if (palco) leave(palco, 0.35);
  palco = new THREE.Group();
  FRENTE.add(palco);
  fn(palco);
}
function painelTexto(w, h, desenho, estado) { return panel(w, h, desenho, estado); }

// --- tela inicial --------------------------------------------------------------
function telaInicial() {
  etapa = 'inicial';
  hud.visible = false; consoleG.visible = false;
  guia.casa();
  trocar(g => {
    const T = J.telaInicial;
    const p = painelTexto(2.0, 0.74, (ctx, W, H) => {
      cardBg(ctx, W, H, { r: 7 });
      eyebrow(ctx, J.nome, 0, 8, W, { align: 'center' });
      let y = rich(ctx, T.titulo, 12, 17, W - 24, 12, { font: F_HEAD, weight: 800, align: 'center', lh: 1.08 });
      y = rich(ctx, T.subtitulo, 12, y + 4, W - 24, 6.4, { weight: 600, align: 'center' });
      rich(ctx, T.nota, 12, H - 7, W - 24, 3.9, { color: COL.mute, align: 'center', valign: 'bottom' });
    });
    place(p, 0, 1.62, 2.2);
    g.add(p); reveal(p, { owner: g });
    const b = botao(0.82, 0.2, T.botao, () => comecar(), { primary: true });
    place(b, 0, 1.1, 2.1);
    g.add(b); reveal(b, { delay: 0.3, owner: g });
    const f = criarFechar();
    place(f, 0, 0.86, 2.05);
    g.add(f); reveal(f, { delay: 0.4, owner: g });
    guia.alvo(b, { avisar: false });
  });
}
function comecar() {
  if (etapa !== 'inicial') return;
  s = L.novaSessao();
  salvar();
  registrar('session_started');
  hud.visible = true; consoleG.visible = true;
  reveal(hud); reveal(consoleG);
  atualizarHud(false);
  etapa = 'abertura';
  trocar(() => {});
  guia.casa();
  mostrarFase(0, false);
  falar('abertura', () => seguir());
}

// Decide a próxima etapa a partir do estado salvo (também serve para retomar).
function seguir() {
  if (!s) return;
  if (!s.tutorial) return treino();
  const i = s.question_index;
  if (i === 6 && !L.eventoResolvido(s)) return evento();
  if (i < J.perguntas.length) return mostrarPergunta(i);
  return resultado();
}

// --- treino de seleção -----------------------------------------------------------
function treino() {
  etapa = 'treino';
  trocar(g => {
    const p = painelTexto(2.1, 0.24, (ctx, W) => {
      eyebrow(ctx, 'Treino', 0, 0, W, { align: 'center' });
      rich(ctx, J.treino.texto, 0, 9, W, 6.4, { weight: 600, align: 'center', lh: 1.3 });
    });
    place(p, 0, 1.9, 2.35); g.add(p); reveal(p, { owner: g });
    const alt = { id: 'treino', texto: J.treino.objeto, objeto: 'chave' };
    criarAlternativa(g, alt, 0, () => confirmarTreino(g));
  });
  falar('treino');
}
function confirmarTreino(g) {
  if (etapa !== 'treino') return;
  etapa = 'confirmar';
  painelConfirmacao(g, J.treino.objeto, () => {
    s.tutorial = true; salvar();
    registrar('tutorial_completed');
    etapa = 'transicao';
    trocar(() => {});
    falar('treino_ok', () => cartaoFase(0, () => seguir()));
  }, () => { etapa = 'treino'; });
}

// --- cartão de fase -------------------------------------------------------------
function cartaoFase(f, fim, falaKey) {
  etapa = 'transicao';
  mostrarFase(f, true);
  atualizarHud(false);
  const fase = J.fases[f];
  trocar(g => {
    const p = painelTexto(1.8, 0.42, (ctx, W, H) => {
      cardBg(ctx, W, H, { r: 7, accent: COL.yellow, strong: true });
      eyebrow(ctx, `Fase ${f + 1} de 4`, 0, 8, W, { align: 'center', color: COL.yellow });
      rich(ctx, fase.nome, 0, 16, W, 13, { font: F_HEAD, weight: 800, align: 'center' });
      rich(ctx, fase.chamada, 0, 31, W, 6.2, { align: 'center', color: COL.text });
    });
    place(p, 0, 1.62, 2.2); g.add(p); reveal(p, { owner: g });
  });
  if (falaKey) falar(falaKey, () => tw(0.6, () => {}, { done: fim, ease: E.lin }));
  else tw(2.8, () => {}, { done: fim, ease: E.lin });
}

// --- pergunta --------------------------------------------------------------------
const OBJETOS = {
  celular: () => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.19, 0.015), matObj()); return m; },
  pessoas: () => figuras(3), pessoa: () => figuras(1), equipe: () => figuras(3),
  prancheta: () => pilha(3), papeis: () => pilha(6), contratos: () => pilha(4),
  predio: () => { const g = new THREE.Group(); [[0, 0.09, 0.12], [0.1, 0.06, 0.09]].forEach(([x, y, h]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 2, 0.08), matObj()); b.position.set(x - 0.05, y - 0.05, 0); g.add(b); }); return g; },
  chave: () => { const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 24), matObj()); a.position.x = -0.06; const h = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.018), matObj()); h.position.x = 0.03; g.add(a, h); return g; },
  alvo: () => { const g = new THREE.Group(); [0.09, 0.06, 0.03].forEach(r => g.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 8, 32), matObj()))); return g; },
  dispersao: () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 20), matObj()); t.position.set(Math.cos(i * 1.3) * 0.08, Math.sin(i * 2.1) * 0.06, 0); g.add(t); } return g; },
  moeda: () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 28), matObj(YEL)); m.rotation.x = Math.PI / 2; return m; },
  rede: () => { const g = new THREE.Group(); const p = [[-0.07, -0.04], [0.07, -0.04], [0, 0.07]]; p.forEach(([x, y]) => { const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), matObj()); s2.position.set(x, y, 0); g.add(s2); }); const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([...p, p[0]].map(([x, y]) => new THREE.Vector3(x, y, 0))), new THREE.LineBasicMaterial({ color: YEL, transparent: true })); g.add(l); return g; },
  funil: () => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 24, 1, true), matObj()); m.rotation.x = Math.PI; return m; },
  grafico: () => { const g = new THREE.Group(); [0.05, 0.09, 0.14].forEach((h, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, h, 0.035), matObj(i === 2 ? YEL : ORG)); b.position.set(-0.05 + i * 0.05, h / 2 - 0.07, 0); g.add(b); }); return g; },
  lupa: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 28), matObj())); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 8), matObj()); c.position.set(0.055, -0.055, 0); c.rotation.z = Math.PI / 4; g.add(c); return g; },
  espelho: () => { const g = new THREE.Group(); [-0.035, 0.035].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.01), matObj()); p.position.x = x; g.add(p); }); return g; },
  alavanca: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.05), matObj()); b.position.y = -0.06; const h = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.13, 8), matObj()); h.rotation.z = -0.5; h.position.set(0.02, 0, 0); const k = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), matObj(YEL)); k.position.set(0.05, 0.055, 0); g.add(b, h, k); return g; },
  canal: () => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 20), matObj()); m.rotation.z = -Math.PI / 2; return m; },
  e3: () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), matObj(ORG, 0.9)); g.add(m); g.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: YEL, transparent: true }))); return g; },
  megafone: () => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 20, 1, true), matObj()); m.rotation.z = Math.PI / 2; return m; },
  engrenagem: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 8, 24), matObj())); for (let i = 0; i < 8; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.025), matObj()); const a = i * Math.PI / 4; d.position.set(Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0); g.add(d); } return g; },
  carimbo: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.06), matObj()); b.position.y = -0.05; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.07, 10), matObj()); const t = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), matObj(YEL)); t.position.y = 0.05; g.add(b, c, t); return g; },
};
function matObj(cor = ORG, int = 0.5) { return new THREE.MeshStandardMaterial({ color: 0x1b120b, emissive: cor, emissiveIntensity: int, roughness: 0.35, metalness: 0.35, transparent: true }); }
function figuras(n) { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.06, 4, 8), matObj()); const h = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), matObj()); const x = (i - (n - 1) / 2) * 0.065; c.position.set(x, -0.03, 0); h.position.set(x, 0.045, 0); g.add(c, h); } return g; }
function pilha(n) { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.008, 0.14), matObj(i === n - 1 ? YEL : ORG, 0.35)); p.position.y = -0.04 + i * 0.016; p.rotation.y = (i % 2 ? 1 : -1) * 0.08; p.rotation.x = 0.5; g.add(p); } return g; }

function criarAlternativa(g, alt, angulo, aoSelecionar) {
  const grp = new THREE.Group();
  place(grp, angulo, 0, 2.05);
  g.add(grp);
  const c = card(0.6, 0.38, (ctx, W, H, st) => {
    cardBg(ctx, W, H, { r: 5, accent: st.sel ? COL.yellow : COL.orange, strong: st.sel });
    // fonte se ajusta para o texto sempre caber no cartão
    let tam = 6;
    while (tam > 4.2 && rich(ctx, alt.texto, 0, 0, W - 12, tam, { font: F_HEAD, weight: 700, lh: 1.16, dry: true }) > H - 8) tam -= 0.3;
    rich(ctx, alt.texto, 6, H / 2, W - 12, tam, { font: F_HEAD, weight: 700, align: 'center', valign: 'middle', lh: 1.16 });
  }, { sel: false }, () => selecionar());
  c.position.y = 1.22;
  grp.add(c);
  const obj = (OBJETOS[alt.objeto] || OBJETOS.alvo)();
  const holder = new THREE.Group();
  holder.position.set(0, 1.58, 0.02);
  holder.scale.setScalar(1.6);
  holder.add(obj);
  grp.add(holder);
  const alvoObj = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
  holder.add(alvoObj);
  clicavel(alvoObj, () => selecionar());
  alvoObj.userData.hoverFn = h => { holder.scale.setScalar(1.6 * (1 + 0.15 * Math.min(h, 1))); };
  const brilho = glow(0.5, ORG, 0.25); brilho.position.copy(holder.position); grp.add(brilho);
  addUpdater(g, (t, dt) => { obj.rotation.y += dt * (c.userData.mesh.userData.state.sel ? 2 : 0.6); holder.position.y = 1.58 + Math.sin(t * 1.5 + angulo) * 0.015; });
  reveal(grp, { delay: 0.25 + (angulo + 45) / 90 * 0.3, owner: g });
  function selecionar() {
    if (pausado) return;
    tocou();
    g.userData.alts && g.userData.alts.forEach(a => a.marcar(a.grp === grp));
    aoSelecionar(alt, grp);
  }
  const reg = { grp, alt, marcar: on => { const st = c.userData.mesh.userData.state; if (st.sel !== on) { st.sel = on; c.userData.mesh.userData.redraw(); } op(brilho, on ? 0.7 : 0.25); } };
  (g.userData.alts = g.userData.alts || []).push(reg);
  return reg;
}

function mostrarPergunta(i) {
  const q = J.perguntas[i];
  const faseIdx = J.fases.findIndex(f => f.id === q.fase);
  // transições entre fases (com a fala do roteiro)
  if (faseIdx > faseVisivel) {
    const falaKey = i === 2 ? 'trans_Q2' : i === 4 ? 'trans_Q4' : i === 6 ? 'trans_evento' : null;
    return cartaoFase(faseIdx, () => mostrarPergunta(i), falaKey);
  }
  etapa = 'pergunta';
  avisouInatividade = false; avisouOperador = false; tocou();
  atualizarHud(false);
  guia.casa();
  trocar(g => {
    const p = painelTexto(2.25, 0.3, (ctx, W) => {
      eyebrow(ctx, `Decisão ${i + 1} de 8 · ${J.fases[faseIdx].nome}`, 0, 0, W, { align: 'center' });
      rich(ctx, q.texto, 0, 10, W, 8.6, { font: F_HEAD, weight: 700, align: 'center', lh: 1.15 });
    });
    place(p, 0, 2.0, 2.35); g.add(p); reveal(p, { owner: g });
    q.alternativas.forEach((a, k) => criarAlternativa(g, a, ANG[k], (alt, grp) => pedirConfirmacao(g, q, alt)));
  });
  falar(q.id);
}

// --- confirmação -----------------------------------------------------------------
let confG = null;
function painelConfirmacao(g, texto, ok, cancelar) {
  if (confG) { leave(confG, 0.2); confG = null; }
  const c = new THREE.Group();
  confG = c;
  g.add(c);
  (g.userData.alts || []).forEach(a => setAlpha(a.grp, 0.4));
  const p = painelTexto(1.5, 0.3, (ctx, W, H) => {
    cardBg(ctx, W, H, { r: 6, accent: COL.yellow, strong: true });
    rich(ctx, J.interface.confirmarPergunta.replace('{alternativa}', `*${texto}*`), 10, H / 2, W - 20, 6.4, { weight: 600, align: 'center', valign: 'middle', hi: COL.yellow, lh: 1.25 });
  });
  place(p, 0, 1.52, 1.7); c.add(p);
  const bOk = botao(0.5, 0.15, J.interface.confirmar, () => { if (pausado) return; leave(c, 0.2); confG = null; ok(); }, { primary: true });
  const bNao = botao(0.5, 0.15, J.interface.escolherOutra, () => {
    if (pausado) return;
    leave(c, 0.2); confG = null;
    (g.userData.alts || []).forEach(a => { setAlpha(a.grp, 1); a.marcar(false); });
    cancelar && cancelar();
  });
  place(bOk, 8.5, 1.25, 1.65); place(bNao, -8.5, 1.25, 1.65);
  c.add(bOk, bNao);
  reveal(c, { dy: 0.05, dur: 0.4 });
  guia.alvo(bOk);
}
function pedirConfirmacao(g, q, alt) {
  if (etapa !== 'pergunta' && etapa !== 'confirmar') return;
  etapa = 'confirmar';
  painelConfirmacao(g, alt.texto, () => confirmar(q, alt), () => { etapa = 'pergunta'; guia.casa(); });
}
function confirmar(q, alt) {
  if (s.answers[q.id]) return;                    // nunca pontua duas vezes
  const delta = L.confirmarResposta(s, q.id, alt.id);
  salvar();
  registrar('answer_confirmed', { question_id: q.id, answer_id: alt.id, casa: s.current_house });
  calarFala();
  feedback(q, alt, delta);
}

// --- feedback --------------------------------------------------------------------
function textoMovimento(n) {
  const I = J.interface;
  if (n > 1) return I.avance.replace('{n}', n);
  if (n === 1) return I.avanceUma;
  if (n === 0) return I.permaneca;
  return I.volte.replace('{n}', Math.abs(n));
}
function feedback(q, alt, delta) {
  etapa = 'feedback';
  const melhores = L.melhores(q.id);
  const aprendizado = melhores.some(m => m.id === alt.id) ? null
    : J.interface.aprendizado.replace('{alternativa}', melhores.map(m => m.texto).join('” ou “'));
  // o peão anda pelo tabuleiro antes do texto aparecer
  trocar(g => {
    const aviso = painelTexto(1.0, 0.16, (ctx, W, H) => pill(ctx, W, H, textoMovimento(alt.casas), { primary: true, size: 8 }));
    place(aviso, 0, 1.42, 1.9); g.add(aviso); reveal(aviso, { owner: g, dy: 0.05 });
  });
  guia.alvo(tab.peao);
  atualizarHud(true);
  andarAte(s.current_house).then(() => mostrarFeedback(q, alt, aprendizado));
}
function mostrarFeedback(q, alt, aprendizado) {
  if (etapa !== 'feedback') return;
  sfx(alt.casas >= 3 ? 'sucesso' : 'chamado', camera.getWorldPosition(v3));
  trocar(g => {
    const p = painelTexto(1.9, 0.76, (ctx, W, H) => {
      cardBg(ctx, W, H, { r: 7, accent: alt.casas >= 3 ? COL.yellow : COL.orange, strong: true });
      eyebrow(ctx, `Decisão ${s.question_index} de 8 · você escolheu`, 12, 9, W - 24, { size: 4 });
      let y = rich(ctx, alt.texto, 12, 17, W - 24, 7.6, { font: F_HEAD, weight: 700, lh: 1.12 });
      ctx.font = `800 12px ${F_HEAD}`; ctx.fillStyle = alt.casas >= 3 ? COL.yellow : alt.casas === 0 ? '#FF9A8A' : COL.orange;
      ctx.fillText(textoMovimento(alt.casas), 12, y + 3);
      y = rich(ctx, alt.feedback, 12, y + 20, W - 24, 5.4, { lh: 1.4 });
      if (aprendizado) rich(ctx, aprendizado, 12, y + 4, W - 24, 4.4, { color: COL.mute, lh: 1.35 });
    });
    place(p, 0, 1.62, 2.0); g.add(p); reveal(p, { owner: g });
    const b = botao(0.5, 0.16, J.interface.continuar, () => { if (pausado) return; depoisDoFeedback(q); }, { primary: true });
    place(b, 0, 1.12, 1.95); g.add(b); reveal(b, { delay: 0.6, owner: g });
    tw(1.2, () => {}, { owner: g, done: () => guia.alvo(b) });
  });
}
function depoisDoFeedback(q) {
  if (etapa !== 'feedback') return;
  if (q.id === 'Q6') return evento();
  if (q.id === 'Q8') { etapa = 'transicao'; trocar(() => {}); return falar('trans_Q8', () => resultado()); }
  seguir();
}

// --- caminho (o jogador é o peão) -------------------------------------------------
// Avança até a casa indicada, mostrando o faturamento quando o peão entra numa faixa nova.
function andarAte(casa) {
  return andar(tab.casa, casa, { aoCruzarFaixa: (n, pos) => balaoFaixa(n, pos) });
}
function balaoFaixa(n, posMundo) {
  const t = `${L.receita(n).texto}/mês`;
  const b = panel(0.5, 0.11, (ctx, W, H) => pill(ctx, W, H, t, { primary: true, size: 6.4 }));
  b.material.depthTest = false;
  b.renderOrder = 35;
  // sempre à frente, em distância confortável de leitura (a casa pode estar aos pés do jogador)
  b.position.set(0, 1.12, -2.3);
  FRENTE.add(b);
  sfx('guia', posMundo);
  tw(1.8, k => { b.position.y = 1.12 + 0.2 * k; op(b, k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25); }, { ease: E.out, done: () => kill(b) });
}

// --- carta surpresa ---------------------------------------------------------------
function evento() {
  etapa = 'evento';
  const tipo = s.event_type;
  const EV = J.evento[tipo];
  trocar(g => {
    // à esquerda: o canal que perdeu desempenho
    const esq = painelTexto(0.95, 0.62, (ctx, W, H) => {
      cardBg(ctx, W, H, { r: 6, accent: '#E0524B', strong: true });
      eyebrow(ctx, 'Alerta', 8, 7, W, { color: '#FF9A8A', size: 4 });
      rich(ctx, J.evento.notificacao, 8, 15, W - 16, 7, { font: F_HEAD, weight: 700, lh: 1.12 });
      ctx.strokeStyle = '#E0524B'; ctx.lineWidth = 1; ctx.beginPath();
      [0.85, 0.8, 0.82, 0.6, 0.45, 0.3, 0.28].forEach((v, i) => { const x = 10 + i * (W - 20) / 6, y = H - 8 - v * 20; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    });
    place(esq, -42, 1.55, 2.1); g.add(esq); reveal(esq, { owner: g });
    sfx('chamado', esq.getWorldPosition(v3));
    guia.alvo(esq);
    falar('evento_abertura', () => {
      // seta para a direita e o efeito da sua estratégia
      const seta = painelTexto(0.8, 0.14, (ctx, W, H) => pill(ctx, W, H, `${J.evento.seta}  ›`, { size: 5.6 }));
      place(seta, 2, 1.25, 2.0); g.add(seta); reveal(seta, { owner: g });
      addUpdater(g, t => { seta.position.x = Math.sin(2 * DEG) * 2.0 + 0.05 * Math.sin(t * 4); });
      const delta = L.aplicarEvento(s);
      salvar();
      registrar('event_shown', { event_type: tipo, casa: s.current_house });
      const dir = painelTexto(1.0, 0.66, (ctx, W, H) => {
        cardBg(ctx, W, H, { r: 6, accent: delta >= 0 ? COL.yellow : COL.orange, strong: true });
        rich(ctx, EV.titulo, 8, 8, W - 16, 7.4, { font: F_HEAD, weight: 700, lh: 1.12 });
        ctx.font = `800 9px ${F_HEAD}`; ctx.fillStyle = delta > 0 ? COL.yellow : delta < 0 ? '#FF9A8A' : COL.text;
        ctx.fillText(textoMovimento(J.evento[tipo].casas), 8, 27);
        rich(ctx, EV.texto, 8, 40, W - 16, 4.3, { color: COL.text, lh: 1.35 });
      });
      place(dir, 38, 1.62, 2.1); g.add(dir);
      dir.visible = false;
      g.updateMatrixWorld(true);
      // a carta sai do baralho no tabuleiro, vira e vira o painel da direita
      virarCarta(dir.getWorldPosition(new THREE.Vector3())).then(() => {
        dir.visible = true;
        reveal(dir, { owner: g });
        sfx(delta >= 0 ? 'sucesso' : 'soltar', dir.getWorldPosition(v3));
        guia.alvo(tab.peao);
        atualizarHud(true);
        andarAte(s.current_house).then(() => guia.alvo(dir));
        falar(tipo, () => {
          if (tipo === 'EV1') return recuperacao(g, dir);
          botaoContinuarEvento(g);
        });
      });
    });
  });
}
function botaoContinuarEvento(g) {
  const b = botao(0.62, 0.16, J.evento.continuar, () => {
    if (pausado || !L.eventoResolvido(s)) return;
    seguir();
  }, { primary: true });
  place(b, 30, 1.0, 2.0); g.add(b); reveal(b, { owner: g });
  guia.alvo(b);
}
function recuperacao(g) {
  const R = J.evento.EV1.recuperacao;
  const obj = new THREE.Group();
  place(obj, 30, 0, 2.0);
  g.add(obj);
  const p = painelTexto(0.95, 0.36, (ctx, W, H) => {
    cardBg(ctx, W, H, { r: 6, accent: COL.yellow, strong: true });
    rich(ctx, R.titulo, 7, 6, W - 14, 6.6, { font: F_HEAD, weight: 700, hi: COL.yellow });
    rich(ctx, R.texto, 7, 15, W - 14, 3.9, { lh: 1.32 });
  });
  p.position.y = 1.2; obj.add(p);
  const luz = glow(0.9, YEL, 0.5); luz.position.set(0, 1.2, -0.05); obj.add(luz);
  const bA = botao(0.62, 0.13, R.ativar, () => escolher(true), { primary: true });
  const bS = botao(0.62, 0.13, R.seguir, () => escolher(false));
  bA.position.set(0, 0.95, 0); bS.position.set(0, 0.79, 0);
  obj.add(bA, bS);
  reveal(obj, { owner: g });
  sfx('acender', p.getWorldPosition(v3));
  guia.alvo(bA);
  falar('EV1_rec');
  let feito = false;
  function escolher(ativar) {
    if (feito || pausado) return;
    feito = true;
    L.escolherRecuperacao(s, ativar);
    salvar();
    registrar('recovery_selected', { choice: ativar ? 'ativar' : 'seguir', casa: s.current_house });
    atualizarHud(true);
    andarAte(s.current_house);
    leave(bA, 0.2); leave(bS, 0.2);
    const msg = painelTexto(0.95, 0.16, (ctx, W, H) => rich(ctx, ativar ? R.aoAtivar : R.aoSeguir, 0, H / 2, W, 4.4, { align: 'center', valign: 'middle', lh: 1.3 }));
    msg.position.y = 0.92; obj.add(msg); reveal(msg);
    calarFala();
    falar(ativar ? 'EV1_ativar' : 'EV1_seguir', () => botaoContinuarEvento(g));
  }
}

// --- resultado --------------------------------------------------------------------
let videoProva = null, videoReel = null;
function resultado() {
  const r = L.concluir(s);
  if (!r) return;
  etapa = 'resultado';
  salvar();
  limparSessao();
  registrar('result_shown', { final: r.id, casa: r.casa, valor: r.valor });
  guardarUltimo(r, false);
  atualizarHud(false);
  hud.visible = false;          // o resultado já mostra tudo; o painel geral fica na parede de indicadores
  tw(2.5, k => setLuz(lerp(amb.luz, 1, k)), { ease: E.inOut });
  flashLuz();
  girarNucleo();
  sfx('acender', camera.getWorldPosition(v3));
  trocar(g => {
    const R = J.resultado;
    const p = painelTexto(2.2, 1.4, (ctx, W, H) => {
      cardBg(ctx, W, H, { r: 7, accent: COL.yellow, strong: true });
      eyebrow(ctx, `${R.rotulo} · código ${s.codigo}`, 12, 8, W - 24, { size: 4 });
      ctx.font = `800 16px ${F_HEAD}`; ctx.fillStyle = COL.yellow; ctx.fillText(`${r.valor}/mês`, 12, 15);
      let y = rich(ctx, r.titulo, 12, 34, W - 24, 9, { font: F_HEAD, weight: 700, lh: 1.1 });
      y = rich(ctx, r.texto, 12, y + 3, W - 24, 5, { color: COL.mute, lh: 1.38 });
      const col = (x, w, titulo, itens) => {
        let yy = y + 8;
        ctx.font = `700 4px ${F_BODY}`; ctx.letterSpacing = '0.6px'; ctx.fillStyle = COL.orange; ctx.fillText(titulo.toUpperCase(), x, yy);
        ctx.letterSpacing = '0px';
        yy += 7;
        for (const t of itens) {
          ctx.beginPath(); ctx.arc(x + 1.4, yy + 2.6, 1.1, 0, 7); ctx.fillStyle = COL.yellow; ctx.fill();
          yy = rich(ctx, t, x + 5, yy, w - 5, 4.4, { lh: 1.3 }) + 2.2;
        }
      };
      col(12, (W - 34) / 2, R.ajudou, r.acertos.length ? r.acertos : [r.semAcerto]);
      col(W / 2 + 5, (W - 34) / 2, R.proximo, r.gargalos.length ? r.gargalos.map(x => x.texto.charAt(0).toUpperCase() + x.texto.slice(1) + '.') : [r.semGargalo]);
    });
    place(p, -6, 1.74, 2.2); g.add(p); reveal(p, { owner: g });
    const bCta = botao(0.95, 0.17, R.botaoCta, () => cta(g), { primary: true });
    const bEsc = botao(0.6, 0.15, R.botaoEscolhas, () => verEscolhas(g));
    place(bCta, -15, 0.86, 2.1); place(bEsc, 11, 0.86, 2.1);
    g.add(bCta, bEsc); reveal(bCta, { delay: 0.8, owner: g }); reveal(bEsc, { delay: 0.9, owner: g });
    tw(2, () => {}, { owner: g, done: () => guia.alvo(bCta) });
    // narração: título, corpo e convite (com a prova social quando houver)
    const pr = r.gargalos[0] ? `prio_${r.gargalos[0].letra}` : 'prio_nenhum';
    const valKey = 'val_' + ({ 'R$ 0': 0, 'R$ 10 mil': 10, 'R$ 30 mil': 30, 'R$ 70 mil': 70, 'R$ 150 mil': 150, 'R$ 300 mil': 300, 'R$ 500 mil': 500, 'R$ 700 mil': 700, 'R$ 850 mil': 850 }[r.valor] ?? 0);
    const seq = ['R1', 'R2', 'R3'].includes(r.id)
      ? [`tit_${r.id}`, r.id === 'R3' ? 'parabens' : null, valKey, `corpo_${r.id}`, pr]
      : [`tit_${r.id}`, `corpo_${r.id}`];
    const P = J.provaSocial;
    falar(seq, () => {
      if (P.ativo) { falar('prova', () => provaSocial(g, () => falar('encerramento'))); }
      else falar('encerramento');
    });
  });
}
function provaSocial(g, fim) {
  const P = J.provaSocial;
  const grp = new THREE.Group();
  place(grp, 40, 1.55, 2.1);
  g.add(grp);
  const video = document.createElement('video');
  video.src = P.video; video.playsInline = true; video.crossOrigin = 'anonymous'; video.preload = 'auto';
  video.setAttribute('playsinline', '');
  const tex = new THREE.VideoTexture(video); tex.colorSpace = THREE.SRGBColorSpace;
  const moldura = painelTexto(0.52, 0.98, (ctx, W, H) => {
    cardBg(ctx, W, H, { r: 4, accent: COL.yellow, strong: true });
    ctx.font = `700 4px ${F_BODY}`; ctx.fillStyle = COL.text; ctx.textAlign = 'center';
    ctx.fillText(`${P.cliente} · ${P.escritorio}`, W / 2, H - 6.5);
  });
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.82), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true }));
  tela.position.set(0, 0.04, 0.003); tela.userData.video = video;
  grp.add(moldura, tela);
  const leg = painelTexto(0.9, 0.16, (ctx, W, H, st) => {
    if (!st.t) return;
    ctx.beginPath(); ctx.roundRect(0, 0, W, H, 3); ctx.fillStyle = 'rgba(8,6,4,0.85)'; ctx.fill();
    rich(ctx, st.t, 4, H / 2, W - 8, 4.4, { align: 'center', valign: 'middle', lh: 1.3 });
  }, { t: '' });
  leg.position.set(0, -0.6, 0.02); grp.add(leg);
  const pular = botao(0.3, 0.1, 'Pular ›', () => terminar());
  pular.position.set(0, -0.76, 0.02); grp.add(pular);
  reveal(grp, { owner: g });
  videoProva = video;
  let acabou = false;
  const terminar = () => { if (acabou) return; acabou = true; video.pause(); duckVideo(false); fim && fim(); };
  video.addEventListener('ended', terminar);
  grp.getWorldPosition(v3);
  somEspacialVideo(video, v3);
  duckVideo(true);
  video.play().catch(() => terminar());
  addUpdater(g, () => {
    const t = video.currentTime;
    const c = P.legendas.find(x => t >= x.de && t < x.ate);
    const txt = c ? c.t : '';
    if (txt !== leg.userData.state.t) { leg.userData.state.t = txt; leg.userData.redraw(); }
  });
}
function verEscolhas(g) {
  const lista = J.perguntas.map((q, i) => { const a = L.alternativa(s.answers[q.id]); return `${i + 1}. ${a ? a.texto : '—'} (${a ? textoMovimento(a.casas).toLowerCase() : ''})`; });
  const extra = s.event_type ? `Carta surpresa: ${J.evento[s.event_type].titulo}${s.event_type === 'EV1' ? ` · recuperação: ${s.recovery_choice === 'ativar' ? 'ativada' : 'não ativada'}` : ''}` : '';
  const p = painelTexto(1.7, 0.86, (ctx, W, H) => {
    cardBg(ctx, W, H, { r: 6 });
    eyebrow(ctx, 'Suas escolhas (somente leitura)', 10, 8, W - 20, { size: 4 });
    let y = 17;
    for (const t of lista) y = rich(ctx, t, 10, y, W - 20, 4.6, { lh: 1.3 }) + 1.6;
    if (extra) rich(ctx, extra, 10, y + 2, W - 20, 4.4, { color: COL.yellow, lh: 1.3 });
  });
  place(p, -6, 1.6, 1.85);
  g.add(p); reveal(p, { owner: g });
  const fechar = botao(0.4, 0.13, 'Fechar', () => { leave(p, 0.2); leave(fechar, 0.2); });
  place(fechar, -6, 1.1, 1.8); g.add(fechar); reveal(fechar, { owner: g });
}
async function cta(g) {
  if (etapa !== 'resultado') return;
  etapa = 'fim';
  registrar('cta_selected', { final: s.final_result_id });
  if (videoProva) { videoProva.pause(); duckVideo(false); }
  const r = L.concluir(s);
  guardarUltimo(r, true);
  const corpo = resumoTexto(r);
  const ok = await avisar('E3 VR - Quer conhecer o proximo passo', corpo, 'high');
  calarFala();
  const painelFinal = () => trocar(gg => {
    const p = painelTexto(1.9, 0.4, (ctx, W, H) => {
      cardBg(ctx, W, H, { r: 7, accent: COL.yellow, strong: true });
      rich(ctx, ok ? J.resultado.aposCta : `${J.resultado.aposCta} ${J.resultado.semConexao}`, 14, H / 2, W - 28, 7, { font: F_HEAD, weight: 700, align: 'center', valign: 'middle', lh: 1.2 });
    });
    place(p, 0, 1.6, 2.1); gg.add(p); reveal(p, { owner: gg });
    guia.alvo(p);
  });
  // 1) avisa que vem um vídeo; 2) o vídeo toca; 3) só então pede para tirar os óculos
  let comecou = false;
  const verVideo = () => {
    if (comecou || etapa !== 'fim' || !s) return;
    comecou = true;
    reelFinal(() => { painelFinal(); falar('apos_cta'); });
  };
  trocar(gg => {
    const p = painelTexto(1.9, 0.42, (ctx, W, H) => {
      cardBg(ctx, W, H, { r: 7, accent: COL.yellow, strong: true });
      rich(ctx, ok ? J.resultado.antesVideo : `${J.resultado.antesVideo} ${J.resultado.semConexao}`, 14, H / 2, W - 28, 7, { font: F_HEAD, weight: 700, align: 'center', valign: 'middle', lh: 1.2 });
    });
    place(p, 0, 1.66, 2.1); gg.add(p); reveal(p, { owner: gg });
    const b = botao(0.7, 0.16, J.resultado.botaoVideo, verVideo, { primary: true });
    place(b, 0, 1.25, 2.05); gg.add(b); reveal(b, { delay: 0.5, owner: gg });
    guia.alvo(b);
  });
  // o vídeo começa sozinho depois do aviso (ou na hora, pelo botão)
  falar('antes_video', () => tw(1.2, () => {}, { ease: E.lin, done: verVideo }));
}

// Vídeo de resultados da E3 numa tela vertical à frente do jogador.
function reelFinal(aoTerminar) {
  const R = J.reelFinal;
  const video = document.createElement('video');
  video.src = R.video; video.playsInline = true; video.crossOrigin = 'anonymous'; video.preload = 'auto';
  video.setAttribute('playsinline', '');
  videoReel = video;
  const tex = new THREE.VideoTexture(video); tex.colorSpace = THREE.SRGBColorSpace;
  const HV = 1.3, WV = HV * 9 / 16, Y = 1.55, DIST = 2.1;
  let acabou = false;
  const terminar = () => {
    if (acabou) return;
    acabou = true;
    video.pause(); duckVideo(false);
    guia.mostrar(true);
    if (videoReel === video) videoReel = null;
    aoTerminar && aoTerminar();
  };
  trocar(gg => {
    const quadro = new THREE.Group();
    const moldura = painelTexto(WV + 0.06, HV + 0.06, (ctx, W, H) => cardBg(ctx, W, H, { r: 4, accent: COL.yellow, strong: true }));
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(WV, HV), new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false, transparent: true }));
    tela.position.z = 0.003; tela.renderOrder = 2;
    quadro.add(moldura, tela);
    place(quadro, 0, Y, DIST);
    const rot = painelTexto(1.3, 0.09, (ctx, W, H) => eyebrow(ctx, R.eyebrow, 0, 1.5, W, { align: 'center', color: COL.yellow }));
    place(rot, 0, Y + HV / 2 + 0.11, DIST);
    const pular = botao(0.34, 0.11, R.pular, terminar);
    place(pular, 0, Y - HV / 2 - 0.14, DIST - 0.05);
    gg.add(quadro, rot, pular);
    gg.children.forEach((c, i) => reveal(c, { delay: 0.1 * i, owner: gg }));
    video.addEventListener('playing', () => { tela.material.map = tex; tela.material.color.set(0xffffff); tela.material.needsUpdate = true; }, { once: true });
    quadro.getWorldPosition(v3);
    somEspacialVideo(video, v3);
  });
  video.addEventListener('ended', terminar);
  video.addEventListener('error', terminar);
  guia.mostrar(false);   // a luz-guia não fica na frente do vídeo
  duckVideo(true);
  video.play().catch(() => { video.muted = true; video.play().catch(terminar); });
}

// resumo para o atendente (sem dados pessoais)
function resumoTexto(r) {
  const esc = J.perguntas.map((q, i) => `${q.id}: ${(L.alternativa(s.answers[q.id]) || {}).texto || '—'}`).join('\n');
  return `${ESTACAO} · código ${s.codigo}\nCenário: ${r.id} – ${r.titulo} (${r.interno})\nResultado: ${r.valor}/mês · casa ${r.casa} de 32\n` +
    `Próximo passo: ${r.gargalos.map(x => x.texto).join('; ') || r.semGargalo}\n` +
    `Carta: ${s.event_type}${s.event_type === 'EV1' ? ` · recuperação ${s.recovery_choice}` : ''}\n${esc}\n\n` +
    `Abordagem: "Você chegou a ${r.valor}/mês na simulação e seu principal próximo passo foi ${(r.gargalos[0] || {}).texto || J.prioridades.nenhum}. Hoje, esse ponto também aparece no seu escritório?"`;
}
function guardarUltimo(r, cta) {
  try {
    localStorage.setItem(CHAVE_ULTIMO, JSON.stringify({
      quando: new Date().toISOString(), codigo: s.codigo, estacao: ESTACAO, cta, final: r.id, titulo: r.titulo, interno: r.interno,
      valor: r.valor, casa: r.casa, gargalos: r.gargalos.map(x => x.texto), semGargalo: r.semGargalo, acertos: r.acertos,
      escolhas: J.perguntas.map(q => ({ q: q.texto, a: (L.alternativa(s.answers[q.id]) || {}).texto || '—' })),
      evento: s.event_type, recuperacao: s.recovery_choice,
      abordagem: `Você chegou a ${r.valor}/mês na simulação e seu principal próximo passo foi ${(r.gargalos[0] || {}).texto || J.prioridades.nenhum}. Hoje, esse ponto também aparece no seu escritório? Vamos entender como isso funciona na sua realidade.`,
    }));
  } catch (e) { /* sem armazenamento */ }
}

// ============================================================ pausa e saída ===
let painelPausa = null;
function pausar(oferta = false) {
  if (pausado || etapa === 'inicial' || etapa === 'fim') return;
  pausado = true;
  calarFala();
  if (videoProva) videoProva.pause();
  const g = new THREE.Group();
  painelPausa = g;
  FRENTE.add(g);
  const p = painelTexto(1.3, 0.42, (ctx, W, H, st) => {
    cardBg(ctx, W, H, { r: 7, accent: COL.yellow, strong: true });
    rich(ctx, oferta ? J.interface.pausaOferta : J.interface.pausado, 0, 9, W, 10, { font: F_HEAD, weight: 700, align: 'center' });
    rich(ctx, `Volume: ${Math.round(st.vol * 100)}%`, 0, 24, W, 5.6, { align: 'center', color: COL.mute });
  }, { vol: volume() });
  place(p, 0, 1.6, 1.6); g.add(p);
  const menos = botao(0.18, 0.12, '−', () => { setVolume(volume() - 0.1); p.userData.state.vol = volume(); p.userData.redraw(); });
  const mais = botao(0.18, 0.12, '+', () => { setVolume(volume() + 0.1); p.userData.state.vol = volume(); p.userData.redraw(); });
  place(menos, -11, 1.46, 1.58); place(mais, 11, 1.46, 1.58);
  const cont = botao(0.55, 0.15, J.interface.retomar, () => retomar(), { primary: true });
  place(cont, 0, 1.25, 1.58);
  g.add(menos, mais, cont);
  reveal(g, { dy: 0.05, dur: 0.35 });
  guia.alvo(cont);
}
function retomar() {
  if (!pausado) return;
  pausado = false;
  if (painelPausa) { leave(painelPausa, 0.25); painelPausa = null; }
  tocou();
  avisouInatividade = false; avisouOperador = false;
  if (etapa === 'pergunta') { const q = J.perguntas[s.question_index]; if (q) falar(q.id); }
  if (videoProva && etapa === 'resultado') videoProva.play().catch(() => {});
}
let painelSair = null;
function pedirSaida() {
  if (painelSair || etapa === 'inicial') return;
  const g = new THREE.Group();
  painelSair = g;
  FRENTE.add(g);
  const p = painelTexto(1.3, 0.24, (ctx, W, H) => { cardBg(ctx, W, H, { r: 7, accent: '#E0524B', strong: true }); rich(ctx, J.interface.sairPergunta, 0, H / 2, W, 9, { font: F_HEAD, weight: 700, align: 'center', valign: 'middle' }); });
  place(p, 0, 1.55, 1.55); g.add(p);
  const cont = botao(0.55, 0.15, J.interface.retomar, () => { leave(g, 0.2); painelSair = null; }, { primary: true });
  const enc = botao(0.4, 0.15, J.interface.encerrar, () => { leave(g, 0.2); painelSair = null; encerrar(); });
  place(cont, -8, 1.33, 1.53); place(enc, 9, 1.33, 1.53);
  g.add(cont, enc);
  reveal(g, { dy: 0.05, dur: 0.3 });
  guia.alvo(cont);
}
function encerrar(motivo = 'saida') {
  if (s && s.status === 'em_andamento') { s.status = 'abandonada'; registrar('session_abandoned', { motivo, question_index: s.question_index }); }
  limparSessao();
  calarFala();
  if (videoProva) { videoProva.pause(); videoProva = null; }
  if (videoReel) { videoReel.pause(); videoReel = null; duckVideo(false); guia.mostrar(true); }
  pausado = false;
  if (painelPausa) { kill(painelPausa); painelPausa = null; }
  etapa = 'fim';
  trocar(g => {
    const p = painelTexto(1.6, 0.2, (ctx, W, H) => rich(ctx, J.interface.encerrada, 0, H / 2, W, 8, { font: F_HEAD, weight: 700, align: 'center', valign: 'middle' }));
    place(p, 0, 1.6, 2.1); g.add(p); reveal(p, { owner: g });
  });
  tw(3, () => {}, { done: () => reiniciar(), ease: E.lin });
}

// ================================================================== sessão ===
// No Quest, os primeiros quadros da sessão imersiva ainda não trazem a posição real da
// cabeça; alinhar nesse instante deixa o caminho girado. Espera alguns quadros rastreados.
let esperaPose = null;
function quandoPoseValida(fn) {
  if (!renderer.xr.isPresenting) { fn(); return; }
  esperaPose = { fn, ok: 0, t0: performance.now() };
}
function checarPose() {
  if (!esperaPose) return;
  const f = renderer.xr.getFrame(), ref = renderer.xr.getReferenceSpace();
  const pose = f && ref ? f.getViewerPose(ref) : null;
  esperaPose.ok = pose && !pose.emulatedPosition ? esperaPose.ok + 1 : 0;
  if (esperaPose.ok >= 20 || performance.now() - esperaPose.t0 > 4000) { const { fn } = esperaPose; esperaPose = null; fn(); }
}
function recalibrar() {
  world.rotation.y = yawCabeca();
  camera.getWorldPosition(v3);
  world.position.y = renderer.xr.isPresenting ? clamp(v3.y - 1.6, -0.7, 0.35) : 0;
  world.updateMatrixWorld(true);
  sfx('guia');
}
function reiniciar() {
  calarFala();
  if (videoProva) { videoProva.pause(); videoProva = null; }
  if (videoReel) { videoReel.pause(); videoReel = null; duckVideo(false); guia.mostrar(true); }
  if (s && s.status === 'em_andamento' && Object.keys(s.answers).length) registrar('session_abandoned', { motivo: 'reinicio', question_index: s.question_index });
  s = null;
  limparSessao();
  pausado = false;
  [painelPausa, painelSair].forEach(p => p && kill(p));
  painelPausa = painelSair = null;
  resetarFases();
  setLuz(0);
  mostrarFase(0, false);
  posicionar(0);
  telaInicial();
  tocou();
}
async function entrar() {
  iniciarAudio();
  setEnergia(1);
  setHumor('luz', 2);
  if (temXR) {
    const modo = (await navigator.xr.isSessionSupported('immersive-ar').catch(() => false)) ? 'immersive-ar' : 'immersive-vr';
    try {
      const session = await navigator.xr.requestSession(modo, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      await renderer.xr.setSession(session);
      session.addEventListener('visibilitychange', () => { if (session.visibilityState !== 'visible' && !pausado && etapa !== 'inicial' && etapa !== 'fim') pausar(); });
      esconderTela();
      const ref = renderer.xr.getReferenceSpace();
      if (ref) ref.addEventListener('reset', () => quandoPoseValida(recalibrar));
      quandoPoseValida(() => { recalibrar(); abrirCenario(); });
    } catch (err) { $('status').textContent = 'Não foi possível entrar no modo imersivo: ' + (err && err.message ? err.message : err); }
  } else { esconderTela(); recalibrar(); abrirCenario(); }
}
function abrirCenario() {
  tw(1.6, k => setProg(k), { ease: E.inOut });
  const salva = sessaoSalva();
  if (salva) {
    // retoma a última etapa confirmada, sem reaplicar pontos
    s = salva;
    hud.visible = true; consoleG.visible = true;
    resetarFases();
    const f = J.fases.findIndex(x => x.id === (J.perguntas[Math.min(7, s.question_index)] || {}).fase);
    for (let i = 0; i <= Math.max(0, s.question_index >= 6 && !L.eventoResolvido(s) ? 2 : f); i++) mostrarFase(i, false);
    atualizarHud(false);
    posicionar(s.current_house);
    if (s.event_applied && s.event_type === 'EV1' && !s.recovery_choice) { etapa = 'evento'; trocar(g => recuperacao(g)); }
    else seguir();
  } else reiniciar();
}

// ============================================================== tela (DOM) ===
const $ = id => document.getElementById(id);
let temXR = false;
function esconderTela() { $('inicio').classList.add('off'); $('resumo').classList.add('off'); $('hud').classList.remove('off'); S.iniciou = true; }
function mostrarResumoOperador() {
  let u = null;
  try { u = JSON.parse(localStorage.getItem(CHAVE_ULTIMO) || 'null'); } catch (e) { u = null; }
  if (!u) return false;
  const tb = $('resumoTabela');
  tb.innerHTML = '';
  const linhas = [['Código', u.codigo], ['Cenário', `${u.final} · ${u.titulo}`], ['Direcionamento', u.interno], ['Resultado da simulação', `${u.valor}/mês (casa ${u.casa} de 32)`],
    ['Próximo passo', (u.gargalos.length ? u.gargalos : [u.semGargalo]).join(' · ')], ['Acertos', u.acertos.join(' · ') || '—'],
    ['Carta surpresa', `${u.evento}${u.evento === 'EV1' ? ` · recuperação: ${u.recuperacao}` : ''}`], ['Pediu conversa', u.cta ? 'Sim' : 'Ainda não'],
    ...u.escolhas.map((e, i) => [`Decisão ${i + 1}`, e.a])];
  for (const [k, v] of linhas) { const tr = document.createElement('tr'); const th = document.createElement('th'); th.textContent = k; const td = document.createElement('td'); td.textContent = v; tr.append(th, td); tb.appendChild(tr); }
  $('abordagem').textContent = u.abordagem;
  $('inicio').classList.add('off');
  $('resumo').classList.remove('off');
  $('hud').classList.add('off');
  return true;
}
$('jogar').addEventListener('click', entrar);
$('ultimo').addEventListener('click', () => mostrarResumoOperador());
$('voltarInicio').addEventListener('click', () => { $('resumo').classList.add('off'); $('inicio').classList.remove('off'); });
$('resetHud').addEventListener('click', () => reiniciar());
$('fecharHud').addEventListener('click', () => fecharTudo());
$('abrirDeNovo').addEventListener('click', () => location.reload());
renderer.xr.addEventListener('sessionend', () => {
  if (fechado) return;
  view.yaw = view.pitch = view.tyaw = view.tpitch = 0;
  camera.position.set(0, 1.6, 0);
  world.position.y = 0;
  // depois de tirar o óculos, o resumo fica na tela para o atendente
  if (etapa === 'fim' || etapa === 'resultado') { if (!mostrarResumoOperador()) $('inicio').classList.remove('off'); }
  else { $('inicio').classList.remove('off'); }
  $('hud').classList.add('off');
});
if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then(ok => {
    temXR = ok;
    $('status').textContent = ok ? 'Óculos detectado.' : 'Modo tela, para ensaio. No Quest, este mesmo botão abre o jogo em 3D.';
  }).catch(() => {});
} else $('status').textContent = 'Modo tela, para ensaio. No Quest, este mesmo botão abre o jogo em 3D.';
try { const v = localStorage.getItem('e3vr-narracao'); if (v !== null) setNarracaoAtiva(v === '1'); } catch (e) { /* sem storage */ }
if (localStorage.getItem(CHAVE_ULTIMO)) $('ultimo').hidden = false;

// atalho do operador: segurar B ou Y por 2 s reinicia
let segura = 0;
function checarReset(dt) {
  const ses = renderer.xr.getSession();
  if (!ses) { segura = 0; return; }
  const ap = [...ses.inputSources].some(x => x.gamepad && x.gamepad.buttons[5] && x.gamepad.buttons[5].pressed);
  segura = ap ? segura + dt : 0;
  if (segura > 2) { segura = 0; reiniciar(); }
}
// inatividade: 20 s convite, 45 s avisa o operador e oferece pausa (nunca escolhe pelo visitante)
function checarInatividade() {
  if (pausado || !['pergunta', 'confirmar', 'feedback', 'evento'].includes(etapa)) return;
  const parado = S.T - S.lastInput;
  if (parado > 20 && !avisouInatividade) { avisouInatividade = true; falar('inatividade'); }
  if (parado > 45 && !avisouOperador) {
    avisouOperador = true;
    avisar('E3 VR - Visitante parado', `${ESTACAO}: visitante parado há 45 s na decisão ${Math.min(8, s.question_index + 1)} de 8.`);
    pausar(true);
  }
}
window.addEventListener('keydown', e => {
  if (!S.iniciou) return;
  const k = e.key.toLowerCase();
  if (k === 'r') reiniciar();
  if (k === 'p') (pausado ? retomar() : pausar());
  if (k === 'c') recalibrar();
});

// =================================================================== loop ===
const clock = new THREE.Clock();
function sim(dt) {
  S.T += dt;
  if (!pausado) { updateTweens(dt); updateUpdaters(dt); }
  else updateTweens(dt);   // painéis da pausa ainda animam
  updateAmbiente(S.T, dt);
  updateGuia(dt);
  updatePointers(dt);
  updateCameraTela(dt);
  updateAudio();
  atualizarLegenda(dt);
  checarReset(dt);
  checarInatividade();
}
function frame() { checarPose(); sim(Math.min(clock.getDelta(), 0.05)); renderer.render(scene, camera); }

async function boot() {
  const fontes = ['700 20px "Archivo"', '800 20px "Archivo"', '500 20px "Plus Jakarta Sans"', '600 20px "Plus Jakarta Sans"', '700 20px "Plus Jakarta Sans"'];
  await Promise.race([Promise.all(fontes.map(f => document.fonts.load(f))).catch(() => {}), new Promise(r => setTimeout(r, 2500))]);
  await carregarLogo();
  criarDecor();
  criarTabuleiro(FRENTE);
  // o escritório escuro fica ao lado da casa de início e vai ficando para trás conforme ele avança
  tab.caminho.add(frio);
  frio.position.set(-2.3, 0, 2.6);
  frio.rotation.y = 0.45;
  frio.add(decor[0]);
  criarGuia();
  renderer.setAnimationLoop(frame);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  const avancarTempo = t => { for (let i = 0; i < t * 30; i++) sim(1 / 30); renderer.render(scene, camera); };
  window.__jogo = {
    get s() { return s; }, get etapa() { return etapa; }, entrar, comecar, reiniciar, avancarTempo, view, recalibrar, pausar, retomar, reelFinal,
    // atalhos de teste: escolhe e confirma pelo ID
    responder: aid => { const q = J.perguntas[s.question_index]; const a = q.alternativas.find(x => x.id === aid); if (!a) return; etapa = 'confirmar'; confirmar(q, a); },
    treinar: () => { s.tutorial = true; salvar(); registrar('tutorial_completed'); },
    continuar: () => { const q = J.perguntas[s.question_index - 1]; depoisDoFeedback(q); },
    seguir, recuperar: ativar => { L.escolherRecuperacao(s, ativar); salvar(); atualizarHud(); },
  };
}
boot();
