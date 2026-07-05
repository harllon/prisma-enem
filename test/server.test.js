const test = require("node:test");
const assert = require("node:assert/strict");
const {
  annotateDifficulties,
  detailedTopicsFor,
  difficultyFor,
  difficultyFromPercentile,
  isCompleteQuestion,
  matchesTopic,
  mediaCandidates,
  normalizePayload,
  resolveTopic,
  seededRandom,
  subjectFor
} = require("../server");

test("classifica dificuldade por percentil relativo", () => {
  assert.equal(difficultyFromPercentile(0.25), "facil");
  assert.equal(difficultyFromPercentile(0.26), "media");
  assert.equal(difficultyFromPercentile(0.65), "media");
  assert.equal(difficultyFromPercentile(0.66), "dificil");
  assert.equal(difficultyFromPercentile(0.91), "muito-dificil");
  assert.equal(difficultyFor({ difficultyPercentile: 0.8 }), "dificil");
});

test("distribui níveis dentro da mesma área e edição", () => {
  const items = Array.from({ length: 20 }, (_, index) => ({
    id: index,
    year: 2024,
    discipline: "matematica",
    param_b: index / 10
  }));
  const classified = annotateDifficulties(items);
  const counts = classified.reduce((result, item) => {
    result[item.difficulty] = (result[item.difficulty] || 0) + 1;
    return result;
  }, {});
  assert.deepEqual(counts, { facil: 5, media: 8, dificil: 5, "muito-dificil": 2 });
});

test("normaliza e limita a configuração recebida", () => {
  const value = normalizePayload({
    years: [2008, 2023, "2023", 2024, 2026],
    areas: ["matematica", "invalida"],
    subjects: ["fisica", "invalida"],
    topic: "Geometria plana",
    language: "espanhol",
    distribution: { facil: 2, media: 3, dificil: -1, "muito-dificil": 1 }
  });
  assert.deepEqual(value.years, [2023, 2024]);
  assert.deepEqual(value.areas, ["matematica"]);
  assert.deepEqual(value.subjects, ["fisica"]);
  assert.equal(value.topic, "geometria-plana");
  assert.equal(value.language, "espanhol");
  assert.equal(value.total, 6);
});

test("mapeia disciplinas pela matriz de habilidades", () => {
  assert.equal(subjectFor({ discipline: "ciencias-natureza", skill: { code: "H20" } }), "fisica");
  assert.equal(subjectFor({ discipline: "ciencias-natureza", skill: { code: "H25" } }), "quimica");
  assert.equal(subjectFor({ discipline: "ciencias-natureza", skill: { code: "H13" } }), "biologia");
  assert.equal(subjectFor({ discipline: "ciencias-humanas", skill: { code: "H6" } }), "geografia");
  assert.equal(subjectFor({ discipline: "ciencias-humanas", skill: { code: "H23" } }), "filosofia");
});

test("conteúdo integral corrige habilidades interdisciplinares", () => {
  const chemistry = {
    discipline: "ciencias-natureza",
    skill: { code: "H23", label: "Transformação de energia." },
    alternativesIntroduction: "Qual combustível libera mais dióxido de carbono por energia produzida?",
    alternatives: [
      { text: "Benzeno" },
      { text: "Metano" },
      { text: "Etanol" }
    ]
  };
  assert.equal(subjectFor(chemistry), "quimica");
});

test("refina Física em assuntos específicos", () => {
  const hydrostatics = {
    discipline: "ciencias-natureza",
    skill: { code: "H20" },
    context: "Um corpo de densidade conhecida flutua em um fluido sob a ação do empuxo.",
    alternativesIntroduction: "Determine a pressão hidrostática."
  };
  assert.deepEqual(detailedTopicsFor(hydrostatics), ["Hidrostática"]);
});

test("rejeita questão sem contexto quando todas as alternativas são imagens", () => {
  const incomplete = {
    context: "Disponível em: exemplo.com. Acesso em: 1 jan. 2020.",
    alternativesIntroduction: "Qual expressão resolve a situação?",
    alternatives: ["A", "B", "C", "D", "E"].map((letter) => ({
      letter,
      image: `https://enem.dev/${letter}.png`
    }))
  };
  assert.equal(isCompleteQuestion(incomplete), false);
});

test("normaliza imagens guardadas como objetos e Markdown", () => {
  const urls = mediaCandidates({
    image: null,
    files: [{ localUrl: "https://api.questoes.xtri.online/media/example.png", url: "https://enem.dev/example.png" }],
    context: "![](https://enem.dev/example.png)"
  });
  assert.deepEqual(urls, [
    "https://api.questoes.xtri.online/media/example.png",
    "https://enem.dev/example.png"
  ]);
});

test("reconhece geometria plana por habilidade e conteúdo", () => {
  const topic = resolveTopic("geometria plana");
  assert.equal(topic.id, "geometria-plana");
  assert.equal(matchesTopic({
    discipline: "matematica",
    skill: { code: "H8", label: "Resolver situação-problema com conhecimentos geométricos." },
    context: "Um terreno retangular tem área de 80 metros quadrados.",
    alternatives: []
  }, topic), true);
  assert.equal(matchesTopic({
    discipline: "matematica",
    skill: { code: "H8" },
    context: "Um cilindro tem volume igual a 80 centímetros cúbicos.",
    alternatives: []
  }, topic), false);
});

test("sorteio é reproduzível com a mesma semente", () => {
  const first = seededRandom("prisma");
  const second = seededRandom("prisma");
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
});
