// Confere os cenários de teste do roteiro, na versão enxuta (5 decisões, 20 casas).
// Uso, dentro da pasta e3-jogo:  node tools/testar-regras.mjs
// Cada letra da resposta vale para uma decisão, na ordem: Q1, Q5, Q6, Q7, Q8.
import { novaSessao, confirmarResposta, aplicarEvento, escolherRecuperacao, concluir, receita } from '../js/logica.js';
import { JOGO as J } from '../js/jogo-dados.js';

const IDS = J.perguntas.map(q => q.id);
const CASOS = [
  { resp: 'DDDCD', ativar: false, ev: 'EV1', casa: 5, valor: 'R$ 30 mil', final: 'R1' },
  { resp: 'AACAA', ativar: false, ev: 'EV1', casa: 11, valor: 'R$ 300 mil', final: 'R2' },
  { resp: 'AACAA', ativar: true, ev: 'EV1', casa: 12, valor: 'R$ 300 mil', final: 'R2' },
  { resp: 'BCABB', ev: 'EV3', casa: 19, valor: 'R$ 850 mil', final: 'R3' },
  { resp: 'BBAAA', ev: 'EV2', casa: 20, valor: 'R$ 1 milhão', final: 'R4' },
  { resp: 'BBADC', ev: 'EV2', casa: 20, valor: 'R$ 1 milhão', final: 'R5' },
  { resp: 'BBABB', ev: 'EV2', casa: 20, valor: 'R$ 1 milhão', final: 'R6' },
];

let falhas = 0;
const ok6 = IDS.join(',') === 'Q1,Q5,Q6,Q7,Q8';
if (!ok6) falhas++;
console.log(`${ok6 ? 'OK ' : 'ERRO'} decisões: ${IDS.join(', ')} · tabuleiro de ${J.totalCasas} casas`);
CASOS.forEach((c, i) => {
  const s = novaSessao();
  [...c.resp].forEach((letra, k) => {
    const qid = IDS[k];
    confirmarResposta(s, qid, qid + letra);
    confirmarResposta(s, qid, qid + 'A');            // confirmar de novo não pode somar
    if (qid === 'Q6') { aplicarEvento(s); aplicarEvento(s); if (s.event_type === 'EV1') { escolherRecuperacao(s, c.ativar); escolherRecuperacao(s, true); } }
  });
  const r = concluir(s);
  const ok = r && s.event_type === c.ev && r.casa === c.casa && r.valor === c.valor && r.id === c.final;
  if (!ok) falhas++;
  console.log(`${ok ? 'OK ' : 'ERRO'} caso ${i + 1}: ${c.resp} ${c.ev}${c.ativar ? ' ativar' : ''} → casa ${r && r.casa} · ${r && r.valor} · ${r && r.id}` +
    (ok ? '' : `  (esperado casa ${c.casa} · ${c.valor} · ${c.final})`) + (r ? `  gargalos: ${r.gargalos.map(g => g.letra).join(',') || '—'}` : ''));
});
// limites da tabela de receita
for (const [casa, esperado] of [[0, 'R$ 0'], [2, 'R$ 10 mil'], [10, 'R$ 150 mil'], [15, 'R$ 500 mil'], [16, 'R$ 700 mil'], [18, 'R$ 850 mil'], [19, 'R$ 850 mil'], [20, 'R$ 1 milhão']]) {
  const ok = receita(casa).texto === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? 'OK ' : 'ERRO'} casa ${casa} → ${receita(casa).texto}`);
}
// sessão incompleta não recebe resultado
const inc = novaSessao();
confirmarResposta(inc, 'Q1', 'Q1B');
const okInc = concluir(inc) === null;
if (!okInc) falhas++;
console.log(`${okInc ? 'OK ' : 'ERRO'} sessão incompleta sem resultado`);
console.log(falhas ? `\n${falhas} falha(s)` : '\nTodos os critérios passaram.');
process.exit(falhas ? 1 : 0);
