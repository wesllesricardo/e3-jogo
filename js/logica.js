// =============================================================================
// Regras do Jogo do Crescimento E3 (sem nada de 3D, para poder testar).
// Segue a "Ordem de execução" do roteiro: valida, soma casas e marcadores uma
// única vez por pergunta, limita 0–32, aplica a carta após Q6, a recuperação só
// no EV1 e calcula o final depois de Q8.
// =============================================================================
import { JOGO as J, CONFIG_VERSAO } from './jogo-dados.js';

const LETRAS = ['P', 'D', 'C', 'O', 'G', 'M', 'F'];
const limitar = c => Math.max(0, Math.min(J.totalCasas, c));

export function novaSessao() {
  return {
    session_id: 'S' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    codigo: 'E3-' + String(Math.floor(1000 + Math.random() * 9000)),
    config_version: CONFIG_VERSAO,
    status: 'em_andamento',
    tutorial: false,
    question_index: 0,
    answers: {},
    current_house: 0,
    markers: Object.fromEntries(LETRAS.map(l => [l, 0])),
    event_type: null, event_applied: false,
    recovery_choice: null, recovery_applied: false,
    final_result_id: null, final_revenue: null,
    started_at: new Date().toISOString(), completed_at: null,
  };
}

export const pergunta = qid => J.perguntas.find(q => q.id === qid);
export const alternativa = aid => J.perguntas.flatMap(q => q.alternativas).find(a => a.id === aid);

// Registra a resposta (uma vez por pergunta). Devolve a variação de casas aplicada.
export function confirmarResposta(s, qid, aid) {
  if (s.status !== 'em_andamento' || s.answers[qid]) return 0;
  const q = pergunta(qid);
  const a = q && q.alternativas.find(x => x.id === aid);
  if (!a) return 0;
  s.answers[qid] = aid;
  const antes = s.current_house;
  s.current_house = limitar(antes + a.casas);
  for (const m of a.marcadores) s.markers[m]++;
  if (qid === 'Q5') s.event_type = a.evento;
  s.question_index = J.perguntas.findIndex(x => x.id === qid) + 1;
  return s.current_house - antes;
}

// Carta surpresa: uma única vez, depois de Q6.
export function aplicarEvento(s) {
  if (s.event_applied || !s.answers.Q6 || !s.event_type) return 0;
  const antes = s.current_house;
  s.current_house = limitar(antes + J.evento[s.event_type].casas);
  s.event_applied = true;
  return s.current_house - antes;
}

// Recuperação: só no EV1 e uma única vez.
export function escolherRecuperacao(s, ativar) {
  if (s.event_type !== 'EV1' || !s.event_applied || s.recovery_choice) return 0;
  s.recovery_choice = ativar ? 'ativar' : 'seguir';
  if (!ativar) return 0;
  const r = J.evento.EV1.recuperacao;
  const antes = s.current_house;
  s.current_house = limitar(antes + r.casas);
  s.markers[r.removeMarcador] = Math.max(0, s.markers[r.removeMarcador] - 1);
  s.recovery_applied = true;
  return s.current_house - antes;
}

export function eventoResolvido(s) {
  return s.event_applied && (s.event_type !== 'EV1' || !!s.recovery_choice);
}

export function receita(casa) {
  return J.receita.find(f => casa <= f.ate) || J.receita[J.receita.length - 1];
}

// Os dois maiores marcadores positivos, com desempate fixo.
export function gargalos(s) {
  return LETRAS.filter(l => s.markers[l] > 0)
    .sort((a, b) => s.markers[b] - s.markers[a] || J.desempate.indexOf(a) - J.desempate.indexOf(b))
    .slice(0, 2);
}

// Até dois acertos (respostas de 4 casas), priorizando Q8 → Q1.
export function acertos(s) {
  const ordem = J.perguntas.map(q => q.id).reverse();
  return ordem.map(qid => s.answers[qid] && alternativa(s.answers[qid]))
    .filter(a => a && a.casas === 4).slice(0, 2);
}

export function idFinal(s) {
  const c = s.current_house, M = s.markers.M, F = s.markers.F;
  if (c <= 16) return 'R1';
  if (c <= 24) return 'R2';
  if (c <= 31) return 'R3';
  if (M >= 2) return 'R4';
  if (F >= 2) return 'R5';
  return 'R6';
}

export function prioridade(s) {
  const g = gargalos(s);
  return J.prioridades[g[0] || 'nenhum'];
}

export function completa(s) {
  return J.perguntas.every(q => s.answers[q.id]) && eventoResolvido(s);
}

// Calcula o resultado final. Sessões incompletas não recebem resultado.
export function concluir(s) {
  if (!completa(s)) return null;
  if (s.status !== 'concluida') {
    s.final_result_id = idFinal(s);
    s.final_revenue = receita(s.current_house).valor;
    s.status = 'concluida';
    s.completed_at = new Date().toISOString();
  }
  const f = J.finais[s.final_result_id];
  const valor = receita(s.current_house).texto;
  const g = gargalos(s);
  return {
    id: s.final_result_id,
    titulo: f.titulo,
    interno: f.interno,
    texto: f.texto.replace('{valor}', valor).replace('{prioridade}', prioridade(s)),
    valor,
    casa: s.current_house,
    gargalos: g.map(l => ({ letra: l, texto: J.prioridades[l] })),
    semGargalo: g.length === 0 ? J.semGargalo : null,
    acertos: acertos(s).map(a => a.feedback),
    semAcerto: acertos(s).length === 0 ? J.semAcerto : null,
  };
}

// Melhor avanço da pergunta (para mostrar como aprendizado depois de confirmar).
export function melhores(qid) {
  const q = pergunta(qid);
  const mx = Math.max(...q.alternativas.map(a => a.casas));
  return q.alternativas.filter(a => a.casas === mx);
}
