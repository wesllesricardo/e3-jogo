// =============================================================================
// Jogo do Crescimento E3 · configuração versionada
// Baseada no roteiro "Jornada do escritório ao milhão" (closer sênior).
// Textos entre aspas no roteiro estão aqui exatamente como devem aparecer.
// O cálculo usa os IDs (Q1A, Q1B...), nunca a posição na tela.
// Valores são simulação educativa: não representam previsão de faturamento.
// =============================================================================
export const CONFIG_VERSAO = '2026-11-13.1';

export const JOGO = {
  nome: 'Jogo do Crescimento E3',
  totalCasas: 32,

  telaInicial: {
    titulo: 'Seu escritório pode chegar ao *próximo nível?*',
    subtitulo: '8 decisões. 4 fases. Uma meta: R$ 1 milhão por mês.',
    botao: 'Começar minha jornada',
    nota: 'Simulação educativa. Os valores não representam previsão ou garantia de faturamento.',
  },
  treino: {
    texto: 'Olhe ao redor da sua mesa. Vire a cabeça com calma para conhecer as opções. Selecione uma delas e confirme sua decisão.',
    objeto: 'Conhecer meu escritório',
    confirmar: 'Confirmar',
    pronto: 'Tudo pronto. Agora, a primeira escolha é sua.',
  },

  fases: [
    { id: 'inicio', nome: 'Início', chamada: 'Conquiste seus primeiros clientes.', ambiente: 'Mesa simples, celular e poucos documentos.' },
    { id: 'estruturacao', nome: 'Estruturação', chamada: 'Organize a casa para crescer.', ambiente: 'Organização visual de contatos, tarefas e atendimento.' },
    { id: 'aceleracao', nome: 'Aceleração', chamada: 'Acelere sem perder o controle.', ambiente: 'Painéis de demanda e equipe em atividade.' },
    { id: 'escala', nome: 'Escala', chamada: 'Prepare o próximo patamar.', ambiente: 'Visão gerencial do escritório e indicadores consolidados.' },
  ],

  // marcadores: P posicionamento disperso · D dependência de canal · C falha comercial
  // O operação complexa · G falta de diagnóstico · M pressão de margem e custos · F dependência do fundador
  perguntas: [
    { id: 'Q1', fase: 'inicio', texto: 'Você está começando seu escritório. Qual será sua primeira iniciativa?', alternativas: [
      { id: 'Q1A', texto: 'Criar um Instagram profissional', casas: 2, marcadores: ['P'], objeto: 'celular',
        feedback: 'Você abriu uma vitrine para o escritório. Agora precisa definir o que comunicar e como conduzir os contatos até o atendimento.' },
      { id: 'Q1B', texto: 'Avisar amigos e familiares sobre minha atuação', casas: 4, marcadores: ['D'], objeto: 'pessoas',
        feedback: 'Sua rede trouxe os primeiros quatro casos nesta simulação. É um começo importante; o próximo desafio é construir uma entrada constante de oportunidades.' },
      { id: 'Q1C', texto: 'Buscar consultoria para orientar os primeiros passos', casas: 2, marcadores: [], objeto: 'prancheta',
        feedback: 'Você ganhou direcionamento, mas ainda precisa colocar o plano em prática. Conhecimento começa a gerar valor quando vira execução.' },
      { id: 'Q1D', texto: 'Alugar um escritório físico antes de ter clientes', casas: 1, marcadores: ['M'], objeto: 'predio',
        feedback: 'Você ganhou um espaço presencial, mas assumiu um custo antes de consolidar a receita. A estrutura, sozinha, não gera demanda.' },
    ] },
    { id: 'Q2', fase: 'inicio', texto: 'Os primeiros atendimentos chegaram. Como você vai definir sua atuação?', alternativas: [
      { id: 'Q2A', texto: 'Atender tudo o que aparecer, sem prioridade', casas: 1, marcadores: ['P'], objeto: 'dispersao',
        feedback: 'Você amplia as possibilidades de entrada, mas divide sua atenção e dificulta uma comunicação clara.' },
      { id: 'Q2B', texto: 'Escolher uma área e um público prioritário', casas: 4, marcadores: [], objeto: 'alvo',
        feedback: 'Seu foco facilita a comunicação, o aprendizado e a organização da entrega. Você começa a construir uma proposta mais clara.' },
      { id: 'Q2C', texto: 'Priorizar serviços com honorários iniciais', casas: 3, marcadores: [], objeto: 'moeda',
        feedback: 'Você melhora a perspectiva de entrada de caixa. Ainda precisa avaliar a demanda e sua capacidade de entregar esses serviços.' },
      { id: 'Q2D', texto: 'Oferecer várias áreas com apoio de parceiros', casas: 2, marcadores: ['O'], objeto: 'rede',
        feedback: 'As parcerias ampliam sua capacidade de atendimento, mas exigem alinhamento e controle para manter a qualidade.' },
    ] },
    { id: 'Q3', fase: 'estruturacao', texto: 'A rotina apertou. Tarefas se repetem e alguns contatos ficam sem retorno. O que você faz?', alternativas: [
      { id: 'Q3A', texto: 'Organizar o atendimento e implantar CRM com automações', casas: 4, marcadores: [], objeto: 'funil',
        feedback: 'Você organizou o funil e automatizou tarefas repetitivas. Sua equipe ganha tempo e consegue acompanhar melhor as oportunidades.' },
      { id: 'Q3B', texto: 'Padronizar tarefas e definir responsáveis', casas: 3, marcadores: [], objeto: 'prancheta',
        feedback: 'Você reduz o retrabalho e esclarece quem faz o quê. A operação ganha organização para dar o próximo passo.' },
      { id: 'Q3C', texto: 'Contratar uma pessoa antes de revisar o processo', casas: 2, marcadores: ['M', 'O'], objeto: 'pessoa',
        feedback: 'Você ganha ajuda, mas também aumenta os custos. Sem clareza do processo, parte dos problemas continua.' },
      { id: 'Q3D', texto: 'Continuar fazendo tudo sozinho', casas: 1, marcadores: ['F', 'C'], objeto: 'papeis',
        feedback: 'Você evita um custo agora, mas seu tempo continua sendo o limite do escritório. Alguns contatos seguem sem acompanhamento.' },
    ] },
    { id: 'Q4', fase: 'estruturacao', texto: 'Você quer melhorar o resultado, mas ainda não sabe onde está o principal gargalo. Como decide?', alternativas: [
      { id: 'Q4A', texto: 'Analisar indicadores e agir sobre o principal gargalo', casas: 4, marcadores: [], objeto: 'grafico',
        feedback: 'Você identificou onde perde oportunidades e direcionou os esforços para a prioridade certa.' },
      { id: 'Q4B', texto: 'Buscar um diagnóstico externo e executar as prioridades', casas: 4, marcadores: [], objeto: 'lupa',
        feedback: 'Você ganhou uma leitura especializada e transformou as recomendações em ações. O avanço vem da análise acompanhada de execução.' },
      { id: 'Q4C', texto: 'Repetir a estratégia de outro escritório', casas: 1, marcadores: ['G'], objeto: 'espelho',
        feedback: 'Você encontrou uma referência, mas ela pode não resolver o problema do seu escritório. Falta entender o seu contexto.' },
      { id: 'Q4D', texto: 'Aumentar o investimento sem investigar o problema', casas: 0, marcadores: ['G', 'M'], objeto: 'alavanca',
        feedback: 'Você compromete mais recursos sem saber se o limite está na demanda, no atendimento ou na operação.' },
    ] },
    { id: 'Q5', fase: 'aceleracao', texto: 'Você já tem alguma demanda e quer crescer. Qual estratégia escolhe para a próxima etapa?', alternativas: [
      { id: 'Q5A', texto: 'Concentrar todo o esforço no canal que já traz clientes', casas: 2, marcadores: ['D'], objeto: 'canal', evento: 'EV1',
        feedback: 'Você aprofunda um canal conhecido, mas deixa o escritório mais exposto a uma queda nessa fonte de demanda.' },
      { id: 'Q5B', texto: 'Construir com a E3 uma estratégia integrada e multicanal', casas: 4, marcadores: [], objeto: 'e3', evento: 'EV2',
        feedback: 'Você conecta posicionamento, aquisição e acompanhamento comercial, com mais de uma fonte de oportunidades. Agora precisa manter a execução.' },
      { id: 'Q5C', texto: 'Diversificar os canais com a equipe ou outros parceiros', casas: 3, marcadores: [], objeto: 'rede', evento: 'EV3',
        feedback: 'Você reduz a dependência de uma única fonte. O próximo desafio é integrar a análise e o acompanhamento entre os canais.' },
      { id: 'Q5D', texto: 'Focar apenas no número de seguidores do Instagram', casas: 1, marcadores: ['D', 'P'], objeto: 'celular', evento: 'EV1',
        feedback: 'Sua presença pode crescer, mas seguidores não substituem um processo de geração e acompanhamento de oportunidades.' },
    ] },
    { id: 'Q6', fase: 'aceleracao', texto: 'As oportunidades aumentaram, mas há demora nas respostas e contratos sem acompanhamento. O que você faz?', alternativas: [
      { id: 'Q6A', texto: 'Organizar o comercial com CRM, automações e treinamento', casas: 4, marcadores: [], objeto: 'funil',
        feedback: 'Você combina processo, tecnologia e preparo da equipe. As oportunidades passam a ter responsável e próximo passo definido.' },
      { id: 'Q6B', texto: 'Aumentar os anúncios antes de melhorar o atendimento', casas: 2, marcadores: ['C', 'M'], objeto: 'megafone',
        feedback: 'Chegam mais contatos, mas o gargalo continua. Parte do investimento não se transforma em avanço comercial.' },
      { id: 'Q6C', texto: 'Contratar apoio e definir uma rotina de atendimento', casas: 3, marcadores: [], objeto: 'pessoas',
        feedback: 'Você amplia a capacidade e organiza o acompanhamento. Ainda pode ganhar eficiência com integração e automação.' },
      { id: 'Q6D', texto: 'Centralizar os contatos em mim para garantir qualidade', casas: 1, marcadores: ['F', 'C'], objeto: 'papeis',
        feedback: 'Você mantém o controle direto, mas sua agenda passa a limitar a velocidade do atendimento.' },
    ] },
    { id: 'Q7', fase: 'escala', texto: 'O escritório começou a gerar sobra de caixa. Onde você vai reinvestir?', alternativas: [
      { id: 'Q7A', texto: 'Aumentar o volume de contratos antes de revisar os custos', casas: 3, marcadores: ['M'], objeto: 'contratos',
        feedback: 'Você busca mais faturamento, mas pode crescer consumindo boa parte do resultado com custos e esforço de entrega.' },
      { id: 'Q7B', texto: 'Fortalecer canais rentáveis e a capacidade de entrega', casas: 4, marcadores: [], objeto: 'grafico',
        feedback: 'Você reinveste considerando aquisição e operação. O escritório ganha condições de crescer com mais controle.' },
      { id: 'Q7C', texto: 'Ampliar o espaço físico antes de medir a necessidade', casas: 2, marcadores: ['M'], objeto: 'predio',
        feedback: 'Sua estrutura aumenta, mas o custo também. Falta comprovar se o espaço é o principal limite do crescimento.' },
      { id: 'Q7D', texto: 'Investir na minha produção e manter as decisões comigo', casas: 3, marcadores: ['F'], objeto: 'pessoa',
        feedback: 'Você amplia sua capacidade pessoal, mas a operação continua dependendo da sua presença para avançar.' },
    ] },
    { id: 'Q8', fase: 'escala', texto: 'Na reta final, qual será sua prioridade para buscar o milhão por mês?', alternativas: [
      { id: 'Q8A', texto: 'Buscar o máximo de faturamento, mesmo pressionando a margem', casas: 3, marcadores: ['M'], objeto: 'moeda',
        feedback: 'Você acelera a receita, mas aceita que uma parcela maior fique comprometida com os custos. Faturar mais não significa sobrar mais.' },
      { id: 'Q8B', texto: 'Integrar liderança, indicadores, comercial e operação', casas: 4, marcadores: [], objeto: 'engrenagem',
        feedback: 'Você prepara o escritório para crescer com responsabilidades claras e acompanhamento. O avanço passa a depender menos de decisões isoladas.' },
      { id: 'Q8C', texto: 'Manter todas as aprovações comigo enquanto cresço', casas: 3, marcadores: ['F'], objeto: 'carimbo',
        feedback: 'Você preserva o controle pessoal, mas cria uma fila de decisões que depende de você. O crescimento pode cobrar mais da sua rotina.' },
      { id: 'Q8D', texto: 'Abrir novas áreas antes de consolidar a operação atual', casas: 2, marcadores: ['O', 'P'], objeto: 'rede',
        feedback: 'Você amplia as possibilidades de receita, mas distribui esforço antes de estabilizar o modelo que já existe.' },
    ] },
  ],

  // narrações de transição (depois da pergunta indicada)
  transicoes: {
    Q2: 'Você deu os primeiros passos. Agora precisa organizar o que começou a construir.',
    Q4: 'Com suas escolhas de estrutura definidas, chegou a hora de acelerar. Crescer também exige preparo para imprevistos.',
    evento: 'Você viu como sua estratégia reage a uma mudança. Agora, decida como buscar o próximo patamar.',
    Q8: 'Sua jornada está completa. Vamos ver o resultado das suas decisões.',
  },

  // carta surpresa: roda uma única vez depois de Q6; o tipo vem da resposta de Q5
  evento: {
    notificacao: 'Um dos seus canais perdeu desempenho',
    seta: 'Veja como sua estrutura responde',
    abertura: 'Uma mudança em uma plataforma reduziu a entrada de novos contatos. Olhe para o painel à sua esquerda. Agora, veja à direita como suas escolhas prepararam o escritório para reagir.',
    EV1: { titulo: 'Sua demanda perdeu força', casas: -2,
      texto: 'Seu escritório dependia de uma única fonte de oportunidades. Com a queda desse canal, o crescimento perdeu força. Volte duas casas.',
      recuperacao: {
        titulo: 'Ainda dá para virar o jogo',
        texto: 'Você não controla a mudança da plataforma, mas pode mudar sua estratégia. Organize uma segunda fonte de demanda e o acompanhamento dos contatos.',
        ativar: 'Ativar plano de recuperação', seguir: 'Seguir com a estratégia atual',
        aoAtivar: 'Você começou a reduzir sua dependência. Recupere uma casa e siga sua jornada.',
        aoSeguir: 'Você segue com o modelo atual. A dependência desse canal continua no seu diagnóstico.',
        casas: 1, removeMarcador: 'D',
      } },
    EV2: { titulo: 'Sua estrutura faz diferença', casas: 2,
      texto: 'O canal perdeu desempenho, mas a estratégia construída com a E3 já considerava outras fontes de oportunidades. Você redistribui os esforços e mantém a capacidade de avançar. Avance duas casas.' },
    EV3: { titulo: 'Sua preparação reduziu o impacto', casas: 0,
      texto: 'Outros canais ajudam a compensar parte da queda. Você preserva sua posição e segue ajustando a estratégia. Permaneça nesta casa.' },
    continuar: 'Continuar minha jornada',
  },

  // casa → faturamento simulado por mês
  receita: [
    { ate: 0, valor: 0, texto: 'R$ 0' },
    { ate: 4, valor: 10000, texto: 'R$ 10 mil' },
    { ate: 8, valor: 30000, texto: 'R$ 30 mil' },
    { ate: 12, valor: 70000, texto: 'R$ 70 mil' },
    { ate: 16, valor: 150000, texto: 'R$ 150 mil' },
    { ate: 20, valor: 300000, texto: 'R$ 300 mil' },
    { ate: 24, valor: 500000, texto: 'R$ 500 mil' },
    { ate: 28, valor: 700000, texto: 'R$ 700 mil' },
    { ate: 31, valor: 850000, texto: 'R$ 850 mil' },
    { ate: 32, valor: 1000000, texto: 'R$ 1 milhão' },
  ],

  // desempate fixo dos gargalos
  desempate: ['M', 'F', 'C', 'D', 'O', 'G', 'P'],
  prioridades: {
    M: 'revisar custos e a rentabilidade da operação',
    F: 'distribuir responsabilidades e reduzir a dependência de você',
    C: 'organizar o atendimento e o acompanhamento comercial',
    D: 'diversificar as fontes de oportunidades',
    O: 'padronizar a entrega e ajustar a capacidade operacional',
    G: 'usar indicadores para identificar o principal gargalo',
    P: 'definir com mais clareza sua área e seu público',
    nenhum: 'manter a execução e acompanhar os indicadores',
  },
  semGargalo: 'Seu caminho combinou foco, organização e crescimento. O próximo desafio é sustentar a execução.',
  semAcerto: 'Você concluiu a jornada e identificou decisões que podem melhorar seu próximo passo.',

  // finais (aplicados nesta ordem)
  finais: {
    R1: { titulo: 'Seu escritório está em construção', interno: 'Diagnóstico e posicionamento',
      texto: 'Você chegou a {valor}/mês no jogo. Seus primeiros passos abriram possibilidades, mas ainda há decisões importantes para consolidar o crescimento. O próximo avanço começa por {prioridade}.' },
    R2: { titulo: 'Seu escritório cresceu e precisa consolidar a base', interno: 'Estruturação, comercial e automações, conforme o gargalo',
      texto: 'Você chegou a {valor}/mês no jogo. Existe avanço, mas alguns pontos ainda limitam a continuidade desse crescimento. Seu principal próximo passo é {prioridade}.' },
    R3: { titulo: 'Você chegou perto do milhão', interno: 'Aceleração e integração entre aquisição, comercial e operação',
      texto: 'Parabéns! Você chegou a {valor}/mês no jogo. Suas escolhas construíram um caminho de crescimento. Para buscar o próximo patamar, concentre seus esforços em {prioridade}.' },
    R4: { titulo: 'Você chegou ao milhão com a margem pressionada', interno: 'Indicadores, rentabilidade e revisão do crescimento',
      texto: 'Parabéns! Você chegou a R$ 1 milhão por mês no jogo. Mas suas escolhas aumentaram a pressão sobre os custos. Seu próximo desafio é transformar faturamento em um resultado mais saudável.' },
    R5: { titulo: 'Você chegou ao milhão e ainda é o centro da operação', interno: 'Processos, liderança e automação',
      texto: 'Parabéns! Você chegou a R$ 1 milhão por mês no jogo. Seu esforço levou o escritório até aqui, mas decisões importantes continuam dependendo de você. O próximo passo é distribuir responsabilidades e ganhar tempo.' },
    R6: { titulo: 'Você chegou ao milhão com uma base mais preparada', interno: 'Acompanhamento do próximo ciclo de crescimento',
      texto: 'Parabéns! Você conseguiu traçar um caminho até R$ 1 milhão por mês no jogo, combinando decisões de crescimento e organização. O próximo desafio é sustentar essa execução e continuar evoluindo.' },
  },

  resultado: {
    rotulo: 'Resultado da simulação',
    ajudou: 'O que ajudou você a avançar',
    proximo: 'Seu próximo passo',
    encerramento: 'Diferente do jogo, na vida real você pode contar com apoio em cada etapa. A E3 ajuda a conectar estratégia, marketing, comercial e tecnologia ao momento do seu escritório. Agora, converse com nossa equipe no estande e descubra qual pode ser o seu próximo passo.',
    botaoCta: 'Quero conhecer meu próximo passo',
    botaoEscolhas: 'Ver minhas escolhas',
    aposCta: 'Sua jornada terminou. Aguarde a ajuda da nossa equipe para retirar os óculos e continuar a conversa.',
    semConexao: 'Avise nossa equipe que você quer conhecer o próximo passo.',
  },

  // prova social (depoimento real e autorizado)
  provaSocial: {
    ativo: true,
    cliente: 'Pablo Oliveira',
    escritorio: 'Oliveira e Camilo Advogados',
    marca: 'mais de R$ 1 milhão',
    texto: 'Você viu como cada decisão muda o caminho. Conheça a história de {cliente}, que alcançou {marca} por mês. Agora, converse com a E3 sobre os próximos passos do seu escritório.',
    video: 'media/pablo.mp4',
    poster: 'media/pablo.jpg',
    // legendas do trecho (segundos a partir do início do vídeo)
    legendas: [
      { de: 0, ate: 4, t: 'Em janeiro de 2025, nós faturávamos 100 mil reais.' },
      { de: 4, ate: 9, t: 'Em janeiro de 2026, a gente fatura mais de 1 milhão de reais por mês.' },
      { de: 9, ate: 15.5, t: 'Eu atribuo esse resultado ao trabalho que foi feito pela E3 em conjunto com o escritório.' },
    ],
  },

  interface: {
    confirmarPergunta: 'Sua escolha: {alternativa}. Confirmar esta decisão?',
    confirmar: 'Confirmar',
    escolherOutra: 'Escolher outra',
    avance: 'Avance {n} casas',
    avanceUma: 'Avance 1 casa',
    permaneca: 'Permaneça nesta casa',
    volte: 'Volte {n} casas',
    continuar: 'Continuar',
    aprendizado: 'Nesta simulação, o maior avanço vinha de: “{alternativa}”.',
    inatividade: 'Pode olhar para os lados com calma e escolher uma opção.',
    pausaOferta: 'Quer fazer uma pausa?',
    pausado: 'Jornada pausada',
    retomar: 'Continuar jogando',
    sairPergunta: 'Deseja encerrar sua jornada?',
    encerrar: 'Encerrar',
    encerrada: 'Jornada encerrada. Obrigado por participar!',
  },
};
