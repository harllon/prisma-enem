# Prisma ENEM

Gerador web de questões e cadernos personalizados do ENEM. O app preserva textos,
figuras, gráficos e alternativas e permite definir uma distribuição exata por
dificuldade.

Também é possível filtrar:

- Ciências da Natureza por Biologia, Física ou Química;
- Ciências Humanas por História, Geografia, Filosofia ou Sociologia;
- por mais de 170 assuntos catalogados nas 3.123 questões. A lista se adapta
  às áreas e disciplinas marcadas, evitando diferenças de grafia.

Na tela de resultados, as alternativas podem ser selecionadas diretamente no
site. O Prisma mostra o progresso de respostas, permite limpar as marcações e,
ao revelar o gabarito, destaca acertos e erros sem alterar a versão limpa para
PDF.

## Rodar

Requer Node.js 18 ou superior.

```bash
npm start
```

Acesse `http://127.0.0.1:4173`.

## Deploy na Vercel

Esta versão já inclui `vercel.json` e a função `api/index.js`. No painel da
Vercel, use:

- Framework Preset: `Other`;
- Build Command: vazio/sem build;
- Root Directory: a pasta raiz do app, onde ficam `server.js`, `public/`,
  `data/` e `vercel.json`.

Na Vercel, `api/index.js` recebe todas as rotas via rewrite e reutiliza a lógica
do `server.js`. Localmente, o app continua funcionando com `npm start`.

## Dados e classificação

- Conteúdo e parâmetros TRI: API pública da XTRI, construída sobre questões do ENEM
  e microdados do INEP.
- Catálogo de referência: API ENEM (`enem.dev`).
- A dificuldade é relativa à área e à edição: 25% fáceis, 40% médias, 25%
  difíceis e 10% muito difíceis, ordenadas pelo parâmetro `b`.
- Ao filtrar um assunto, os percentis são recalculados dentro daquele assunto.
- Questões sem `param_b` ou com calibração instável (`b < −3` ou `b > 6`) não
  entram no sorteio por dificuldade.
- Disciplinas são inferidas primeiro pelo conteúdo integral e depois pela matriz
  de habilidades. Isso resolve habilidades interdisciplinares, como a H23, que
  pode aparecer tanto em Física quanto em Química.
- Todas as questões possuem um assunto indexado a partir do texto integral,
  alternativas e habilidade.
- Itens incompletos na fonte, sem contexto suficiente ou sem as cinco
  alternativas, são substituídos antes de o caderno ser montado.
- Figuras passam por um proxy local com URLs alternativas. A normalização aceita
  os diferentes formatos usados pela API (`image`, `files`, Markdown e objetos).
- Fórmulas Markdown/LaTeX simples são convertidas para subscritos, sobrescritos e
  símbolos legíveis no navegador e no PDF.

## Atualizar o índice

O pacote já inclui `data/question-index.json`. Para reconstruí-lo com a versão
mais recente da API:

```bash
npm run build:index
```

O PDF é produzido pelo diálogo de impressão do navegador. A folha de estilo de
impressão cria uma capa enxuta, encaixa várias questões por página quando há
espaço, mantém cada questão inteira e inclui o gabarito ao final.
