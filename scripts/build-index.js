const fs = require("node:fs");
const path = require("node:path");
const {
  mediaCandidates,
  questionSearchText,
  subjectFor,
  topicsFor
} = require("../server");

const API = "https://api.questoes.xtri.online/api";
const OUTPUT = path.join(__dirname, "..", "data", "question-index.json");

async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "PrismaENEM-Indexer/5.0" },
    signal: AbortSignal.timeout(30000)
  });
  if (response.ok) return response.json();
  if (attempt < 5 && [429, 500, 502, 503, 504].includes(response.status)) {
    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    return fetchJson(url, attempt + 1);
  }
  throw new Error(`${response.status} ao consultar ${url}`);
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
      if ((index + 1) % 250 === 0) console.log(`${index + 1}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  return results;
}

async function main() {
  let next = `${API}/questions/`;
  const summaries = [];
  while (next) {
    const page = await fetchJson(next);
    summaries.push(...page.results);
    next = page.next;
  }
  console.log(`${summaries.length} questões encontradas`);

  const details = await mapLimit(summaries, 16, (question) =>
    fetchJson(`${API}/questions/${question.id}/`)
  );
  const index = details.map((question) => ({
    id: question.id,
    year: question.year,
    discipline: question.discipline,
    searchText: questionSearchText(question),
    indexedSubject: subjectFor(question),
    indexedTopics: topicsFor(question).slice(0, 4),
    indexedMedia: mediaCandidates(question)
  }));

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(index));
  console.log(`Índice salvo em ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
