// Confere os "Cenários de teste e critérios de aceite" do roteiro.
// Uso, dentro da pasta e3-jogo:  node tools/testar-regras.mjs
import { novaSessao, confirmarResposta, aplicarEvento, escolherRecuperacao, concluir, receita } from '../js/logica.js';

const CASOS = [
  { resp: 'DADDDDCD', ativar: false, ev: 'EV1', casa: 7, valor: 'R$ 30 mil', final: 'R1' },
  { resp: 'ACBAACAA', ativar: false, ev: 'EV1', casa: 21, valor: 'R$ 500 mil', final: 'R2' },
  { resp: 'ACBAACAA', ativar: true, ev: 'EV1', casa: 22, valor: 'R$ 500 mil', final: 'R2' },
  { resp: 'BBAACABB', ev: 'EV3', casa: 31, valor: 'R$ 850 mil', final: 'R3' },
  { resp: 'BBAABAAA', ev: 'EV2', casa: 32, valor: 'R$ 1 milhão', final: 'R4' },
  { resp: 'BBAABADC', ev: 'EV2', casa: 32, valor: 'R$ 1 milhão', final: 'R5' },
  { resp: 'BBAABABB', ev: 'EV2', casa: 32, valor: 'R$ 1 milhão', final: 'R6' },
];

let falhas = 0;
CASOS.forEach((c, i) => {
  const s = novaSessao();
  [...c.resp].forEach((letra, k) => {
    const qid = `Q${k + 1}`;
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
for (const [casa, esperado] of [[0, 'R$ 0'], [24, 'R$ 500 mil'], [25, 'R$ 700 mil'], [28, 'R$ 700 mil'], [29, 'R$ 850 mil'], [31, 'R$ 850 mil'], [32, 'R$ 1 milhão']]) {
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
