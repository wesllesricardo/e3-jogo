// =============================================================================
// Jogo do Crescimento E3: regras, cartas, eventos e números.
// Todos os valores são ilustrativos e servem para o jogo ficar equilibrado;
// ajuste à vontade. Trechos entre *asteriscos* saem em destaque.
// =============================================================================
export const JOGO = {
  nome: 'Jogo do Crescimento E3',
  meses: 12,
  // ponto de partida (o mesmo para o jogador e para o "escritório sem método")
  base: {
    caixa: 20000,          // R$ no início do ano
    custoFixo: 6000,       // R$ por mês (aluguel, equipe, sistemas)
    leadsIndicacao: 8,     // contatos por mês vindos de indicação
    conversao: 0.15,       // 15% dos contatos viram contrato
    qualidade: 0.5,       // fator de qualidade dos leads de anúncio
    ticket: 2500,          // R$ por contrato
    leadsAnuncio: 10, leadsEscala: 8, leadsE3: 12,
    // ganhos de conversão de cada decisão (pontos percentuais)
    ganhoCrm: 0.05, ganhoTreino: 0.04, ganhoAtendente: 0.03, ganhoE3: 0.03, ganhoProduto: 0.25,
  },
  // cartas de decisão. pilar: aquisicao | produto | comercial | nenhum | e3
  // custo = pago uma vez; mensal = pago todo mês a partir da escolha
  cartas: [
    { id: 'anuncios', pilar: 'aquisicao', titulo: 'Anúncios no Google e no Instagram', texto: 'Campanhas para a sua área de atuação.', mensal: 3000, efeito: '+10 contatos por mês' },
    { id: 'landing', pilar: 'aquisicao', titulo: 'Landing page profissional', texto: 'Uma página feita para transformar clique em conversa.', custo: 2500, efeito: 'Leads de anúncio mais qualificados' },
    { id: 'organico', pilar: 'aquisicao', titulo: 'Postar nas redes por conta própria', texto: 'Sem custo, mas toma o seu tempo de advogado.', custo: 0, efeito: '+1 contato por mês, acumulando · −1% de conversão' },
    { id: 'escala', pilar: 'aquisicao', titulo: 'Dobrar o investimento em anúncios', texto: 'Mais verba nas campanhas que já estão rodando.', mensal: 2500, efeito: '+8 contatos por mês', requer: ['anuncios', 'e3'] },
    { id: 'produto', pilar: 'produto', titulo: 'Definir um produto jurídico', texto: 'Uma ação com escala, como revisão de aposentadoria.', custo: 1500, efeito: 'Ticket +25% · leads mais qualificados' },
    { id: 'expandir', pilar: 'produto', titulo: 'Abrir uma nova área de atuação', texto: 'Atender um novo tipo de caso.', custo: 3000, efeito: '+4 contatos por mês · ticket +10%' },
    { id: 'crm', pilar: 'comercial', titulo: 'CRM com IA no WhatsApp', texto: 'Resposta na hora e cada lead com dono e etapa.', mensal: 1200, efeito: '+5% de conversão · protege leads que esfriam' },
    { id: 'treino', pilar: 'comercial', titulo: 'Treinar o atendimento', texto: 'Script, qualificação e follow-up documentados.', custo: 2000, efeito: '+4% de conversão · protege contra saída de pessoas' },
    { id: 'atendente', pilar: 'comercial', titulo: 'Contratar um atendente', texto: 'Mais uma pessoa respondendo os contatos.', mensal: 2800, efeito: '+3% de conversão' },
    { id: 'e3', pilar: 'e3', titulo: 'Assessoria completa E3', texto: 'Mídia paga, landing page, CRM com IA, treinamento e produto jurídico. Vale a partir do mês seguinte (onboarding).', mensal: 5500, efeito: '+12 contatos por mês · página, CRM, treinamento e produto incluídos', aPartirDoMes: 3 },
    { id: 'indicacao', pilar: 'nenhum', titulo: 'Esperar indicação', texto: 'Não investir e torcer para o telefone tocar.', custo: 0, efeito: 'Nada muda', sempre: true },
  ],
  // o que a assessoria E3 já inclui (essas cartas somem depois de escolher a E3)
  e3Inclui: ['anuncios', 'landing', 'crm', 'treino', 'produto'],
  // roleta do mercado: um evento por mês
  eventos: [
    { id: 'indicacao', titulo: 'Um cliente antigo indicou dois amigos', cor: '#FFB020' },
    { id: 'concorrente', titulo: 'Um concorrente começou a anunciar na sua área', cor: '#E0524B' },
    { id: 'esfriou', titulo: 'Leads esfriaram esperando resposta no WhatsApp', cor: '#E0524B' },
    { id: 'parado', titulo: 'Mês de mercado parado', cor: '#8FA6BC' },
    { id: 'viral', titulo: 'Um vídeo do escritório viralizou', cor: '#FFEC00' },
    { id: 'regra', titulo: 'Uma mudança na lei gerou nova demanda', cor: '#FFB020' },
    { id: 'saiu', titulo: 'Seu atendente pediu demissão', cor: '#E0524B' },
    { id: 'normal', titulo: 'Um mês normal', cor: '#A9A39C' },
  ],
  // pilar mais fraco no fim do jogo → programa sugerido (ids de conteudo.js)
  diagnostico: {
    aquisicao: { pilar: 'Aquisição', programa: 'estruturacao', texto: 'Faltou gerar demanda própria: o escritório ainda depende de indicação.' },
    comercial: { pilar: 'Processo comercial', programa: 'aceleracao', texto: 'Os contatos chegam, mas o atendimento ainda deixa contrato na mesa.' },
    produto: { pilar: 'Produto jurídico', programa: 'evolucao-pro', texto: 'Sem um produto claro, cada caso é vendido do zero e o ticket fica baixo.' },
    // quando o jogador colocou a E3 para trabalhar e não deixou nenhum pilar para trás
    completo: { pilar: 'Escala', programa: 'aceleracao', texto: 'Os três pilares trabalham juntos: o próximo passo é escalar com acompanhamento contínuo.' },
  },
  textos: {
    eyebrow: 'Jogo do Crescimento E3',
    titulo: 'Você tem *12 meses* para fazer o escritório crescer.',
    regras: [
      'Cada mês, gire a roleta do mercado e veja o que acontece.',
      'Depois escolha uma decisão. Elas se somam ao longo do ano.',
      'O escritório sem método joga o mesmo ano, só esperando indicação.',
    ],
    comecar: 'Começar o ano',
    girar: 'Gire a roleta do mercado',
    escolher: 'Escolha a decisão do mês',
    proximo: 'Próximo mês →',
    final: 'Ver resultado do ano →',
    rival: 'Escritório sem método',
    voce: 'Você',
    contato: 'Deixar meu contato',
    jogarDeNovo: 'Jogar de novo',
    aviso: 'Valores ilustrativos. O jogo simplifica a realidade para mostrar o efeito de cada decisão.',
  },
};
