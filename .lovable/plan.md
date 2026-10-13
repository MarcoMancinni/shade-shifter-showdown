# Impérios: A Era das Maravilhas — Arquitetura e Fase 1

## Visão geral
Jogo de tabuleiro digital multiplayer (2–7 jogadores) no navegador, sem cadastro. Toda regra, sorteio e pontuação roda no servidor; o navegador apenas pede ações e exibe o estado recebido em tempo real. Textos em português brasileiro.

## Escopo da Fase 1 (esta entrega)
1. Página inicial temática (pedra, bronze, madeira, iluminação dourada) com "Criar partida" e "Entrar com código".
2. Criar partida: apelido -> sala com código de 5 letras e link `/sala/CODIGO`.
3. Convidado abre o link, informa apelido e entra no lobby.
4. Lobby em tempo real: lista de jogadores, assentos na mesa circular, seleção de civilização (sem repetição), anfitrião inicia (mín. 2).
5. Início da partida no servidor: ordem da mesa, baralhos laterais (um entre cada par de vizinhos) + baralho central, embaralhados no servidor.
6. Turnos sequenciais: o jogador ativo escolhe esquerda, direita ou central; a carta vai para sua área, a próxima carta lateral é revelada, a vez passa. Proteção contra clique duplo (número do turno esperado).
7. Reconexão: ao atualizar a página o jogador volta ao seu lugar.
8. Mesa básica: adversários ao redor, cartas visíveis no centro, área do jogador embaixo. Visual refinado e animações ficam nas Fases 3–4.

## Identidade e segurança do jogador
- Ao entrar, o servidor gera um token secreto do jogador, guardado no navegador. Só o hash fica no banco.
- Toda ação envia código da sala + token; o servidor confere quem é o jogador. Conhecer o link não permite assumir o lugar de alguém.
- Cartas ocultas (baralho central, fundo dos baralhos) ficam em uma tabela sem acesso público; o navegador recebe apenas a carta do topo visível de cada baralho lateral e o tamanho de cada pilha.

## Fluxo técnico
```text
Navegador ──ação(sala, token, turno esperado)──> função no servidor
                                                  │ valida vez/carta
                                                  │ aplica regras (motor puro TS)
                                                  │ grava estado + evento
Banco ──tempo real (mudança na sala)──> todos os navegadores
Navegador ──busca estado público──> exibe mesa
```
O motor de regras é um módulo TypeScript puro (sem banco), testado automaticamente; as funções do servidor carregam o estado, chamam o motor e gravam o resultado em uma transação com verificação de versão.

## Tabelas (Lovable Cloud)
| Tabela | Conteúdo | Leitura pública |
|---|---|---|
| rooms | código, status (lobby/jogando/fim), anfitrião, jogador ativo, número do turno, versão, fichas de conflito ativas | sim |
| room_players | apelido, assento, civilização, hash do token, conectado | sim (sem hash) |
| civilizations | 7 civilizações: nome, maravilha, 5 etapas (custo, pontos, efeito), habilidade | sim |
| card_defs | definição das cartas (categoria, recurso, pontos, ciência, escudos, mascote, conflito) | sim |
| room_decks | baralhos da sala (laterais e central): carta do topo visível, tamanho | sim |
| room_deck_cards | ordem completa das cartas de cada baralho | não (só servidor) |
| player_cards | cartas adquiridas por jogador (públicas) | sim |
| player_wonder_stages | etapas construídas | sim |
| progress_tokens / player_progress | fichas de progresso, estoque e posse | parcial |
| conflicts | batalhas resolvidas e recompensas | sim |
| game_events | histórico ordenado de eventos (para animações e reconexão) | sim |
| results | pontuação final detalhada | sim |

Escrita em todas as tabelas apenas pelo servidor. Tempo real ligado em rooms, room_players, room_decks, player_cards e game_events.

## Componentes
- Páginas: Início, Sala (lobby ou mesa conforme o status), Resultados.
- Lobby: CartaoJogador, SeletorCivilizacao, CodigoConvite (copiar link).
- Mesa: MesaCircular, PainelAdversario, OpcoesDeCarta (esquerda / central oculta / direita), AreaDoJogador (maravilha, recursos, cartas, fichas, escudos, pontos), IndicadorDeTurno, DetalheCivilizacao.
- Base: CartaJogo (5 categorias com ícones originais), MaravilhaVisual (5 etapas, 2.5D).

## Fases seguintes (arquitetura já preparada)
- Fase 2: recursos, construção obrigatória, ciência e fichas, conflitos, mascote, pontuação, fim de partida + testes.
- Fase 3: visual completo da mesa, cartas ilustradas, maravilhas isométricas.
- Fase 4: animações de construção (~3 s), batalha (4–6 s, com pular), tela de vitória progressiva.
- Fase 5: testes de partidas com 2 a 7 jogadores, reconexão e ações simultâneas.

## Detalhes técnicos
- Funções do servidor (createServerFn) para: criarSala, entrarSala, escolherCivilizacao, iniciarPartida, escolherCarta, obterEstado (filtra dados privados por jogador, ex.: dono do mascote vê o topo central).
- Acesso privilegiado ao banco somente dentro das funções, após validar o token.
- Concorrência: `UPDATE rooms ... WHERE version = esperado`; falha -> ação rejeitada sem efeito.
- Embaralhamento com crypto.getRandomValues (Fisher–Yates) no servidor.
- Animações com Framer Motion; 3D (React Three Fiber) avaliado na Fase 3 conforme desempenho.
