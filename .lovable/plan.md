# Mesa no celular — proposta de layout mobile

## Problemas encontrados na mesa atual (telas < 768 px)
1. **Tudo empilhado em uma coluna longa**: cabeçalho, lista de adversários, mesa, maravilha do canto, painel "Evolução e inventário". O jogador precisa rolar para ver as cartas e de novo para construir.
2. **Adversários ocupam o topo**: cada adversário é um cartão largo com miniatura da maravilha; com 4–6 jogadores eles empurram os baralhos para baixo da dobra.
3. **Cartas pequenas e espremidas**: três cartas grandes lado a lado com espaçamento de desktop; a carta central limita-se a 28% da largura e as laterais não, causando proporções diferentes e risco de vazar em 320 px.
4. **Ampliar carta depende de "segurar"**: no toque, a ampliação só aparece com pressão longa e some ao soltar; um toque simples já tenta pegar a carta.
5. **Maravilha duplicada e longe do botão**: a maravilha aparece no canto e o botão de evoluir fica no painel inferior, longe da vez do jogador.
6. **Fichas de batalha no cabeçalho** competem com o código da sala e quebram linha.
7. **Planta do Progresso** em 2 colunas com cartões de altura mínima alta: em celular as 4 fichas não cabem sem rolar.
8. **Cinemáticas** usam tamanhos fixos de desktop; títulos e botão "Continuar" podem ficar cortados ou atrás da barra do sistema (iPhone).
9. **Ambientação** (bandeiras e braseiros animados) pesa no celular sem agregar.

## Nova disposição (somente celular; desktop intacto)

```text
┌──────────────────────────────┐  ← respeita área segura
│ Sala ABCDE · T12   ⚔ ●●●○○○  │  barra compacta
│ [Ana][Bia][Você][Caio] ...   │  fileira de avatares rolável
├──────────────────────────────┤
│   ★ SUA VEZ — escolha 1      │  faixa de turno dourada
│                              │
│  ┌─────┐  ┌─────┐  ┌─────┐   │  3 baralhos, mesma proporção,
│  │ ESQ │  │ CEN │  │ DIR │   │  ~30% da largura cada
│  └─────┘  └─────┘  └─────┘   │
│   Ana ←     12      → Caio   │  vizinho de origem + contagem
│                              │
├──────────────────────────────┤
│ [Maravilha 2/5][Cartas 7]    │  barra inferior fixa (polegar)
│ [Fichas 1][Pontos 14]        │  — cada aba abre uma gaveta
└──────────────────────────────┘
```

### Parte superior
- Uma linha: "Impérios", sala/turno e as fichas de batalha em tamanho reduzido.
- Fileira horizontal de avatares redondos (selo da civilização + apelido curto + pontos). O jogador ativo ganha anel dourado pulsante; vizinhos marcados com "←" e "→". Tocar abre a ficha do adversário em gaveta inferior.

### Área central
- Faixa de turno grande: "Sua vez" (dourado) ou "Vez de Ana".
- Três baralhos com a mesma largura (até ~110 px), cartas legíveis.
- **Toque na carta = ampliar** (visualizador em tela cheia com a ilustração grande e o botão "Pegar esta carta"). Assim não há escolha acidental; a escolha fica sob o polegar.
- Abaixo de cada baralho: de qual vizinho vem e quantas cartas restam.

### Barra inferior fixa (4 abas)
1. **Maravilha** — gaveta com ilustração atual, etapa X/5, recursos necessários vs. disponíveis e botão grande "Erguer etapa". A aba pisca dourado quando a construção estiver disponível.
2. **Cartas** — inventário agrupado por tipo (recursos, ciência, militar, cultura, moeda) com contagem; toque amplia.
3. **Fichas** — fichas de Progresso obtidas e escudos.
4. **Pontos** — pontuação parcial e a Crônica (últimas jogadas), hoje oculta no celular.

As gavetas sobem de baixo, ocupam até 75% da tela, fecham arrastando ou tocando fora.

### Cinemáticas e Planta do Progresso
- Construção, conflito e resultado da batalha: escalonamento pela largura da tela, textos com tamanho fluido, botão "Continuar" fixo acima da área segura inferior.
- Planta do Progresso: grade 2×2 compacta que cabe sem rolar a partir de 320 px, cada ficha com área de toque grande, e confirmação simples.
- Placar final: tabela vira lista de cartões empilhados.

### Desempenho e acabamento
- Desligar bandeiras/braseiros animados no celular; manter texturas de pedra, bronze e pergaminho.
- Sem rolagem horizontal (exceto a fileira de avatares, intencional).
- Botões com no mínimo 44 px; texto base 15–16 px.
- Respeitar áreas seguras (notch e barra do iPhone).

## Detalhes técnicos
- Novo componente `MobileTable` renderizado quando `useIsMobile()` for verdadeiro; `GameTable` continua igual para desktop. Ambos recebem os mesmos dados e as mesmas funções `pick`/`buildWonder` (sem mudar regras nem sincronização).
- Gavetas com o componente `Drawer` (vaul) já existente nos componentes de interface, ou criado se ausente.
- Visualizador de carta em portal com a imagem `/cartas/*.webp`.
- CSS mobile em media queries `max-width: 767px` em `src/styles.css`, mais `env(safe-area-inset-*)` e `viewport-fit=cover` no root.
- Testes com Playwright em 320, 375, 390 e 430 px: sem overflow horizontal, captura de tela de cada estado (turno, gaveta da maravilha, ampliação, planta do progresso, cinemáticas).
