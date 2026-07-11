const levels = ["facil", "media", "dificil", "muito-dificil"];
const levelLabels = {
  facil: "Fácil",
  media: "Média",
  dificil: "Difícil",
  "muito-dificil": "Muito difícil"
};
const areaShortLabels = {
  linguagens: "Linguagens",
  "ciencias-humanas": "Humanas",
  "ciencias-natureza": "Natureza",
  matematica: "Matemática"
};
const subjectLabels = {
  biologia: "Biologia",
  fisica: "Física",
  quimica: "Química",
  historia: "História",
  geografia: "Geografia",
  filosofia: "Filosofia",
  sociologia: "Sociologia"
};

const form = document.querySelector("#builder-form");
const totalInput = document.querySelector("#total-input");
const totalWarning = document.querySelector("#total-warning");
const summaryTotal = document.querySelector("#summary-total");
const summaryDetails = document.querySelector("#summary-details");
const yearFrom = document.querySelector("#year-from");
const yearTo = document.querySelector("#year-to");
const yearCount = document.querySelector("#year-count");
const loading = document.querySelector("#loading");
const toast = document.querySelector("#toast");
const results = document.querySelector("#results");
const questionList = document.querySelector("#question-list");
const answerGrid = document.querySelector("#answer-grid");
const resultsTitle = document.querySelector("#results-title");
const resultsSubtitle = document.querySelector("#results-subtitle");
const selectionProgress = document.querySelector("#selection-progress");
const clearAnswersButton = document.querySelector("#clear-answers-button");
const printCoverMeta = document.querySelector("#print-cover-meta");
const topicInput = document.querySelector("#topic-input");
const topicHelp = document.querySelector("#topic-help");
let lastPayload = null;
let currentQuestions = [];
let selectedAnswers = new Map();
let answersVisible = false;
let toastTimer;
let topicCatalog = [];
let pendingTopic = "";

function populateYears() {
  for (let year = 2009; year <= 2025; year += 1) {
    yearFrom.add(new Option(year, year, false, year === 2009));
    yearTo.add(new Option(year, year, false, year === 2024));
  }
}

function distribution() {
  return Object.fromEntries(
    levels.map((level) => [
      level,
      Math.max(0, Number(document.querySelector(`[data-level="${level}"] input`).value) || 0)
    ])
  );
}

function totalDistributed() {
  return Object.values(distribution()).reduce((sum, value) => sum + value, 0);
}

function selectedAreas() {
  return [...document.querySelectorAll('input[name="area"]:checked')].map((input) => input.value);
}

function selectedSubjects() {
  return [...document.querySelectorAll('input[name="subject"]:checked')].map((input) => input.value);
}

function populateTopicOptions() {
  const previous = topicInput.value || pendingTopic;
  const areas = selectedAreas();
  const subjects = selectedSubjects();
  const visibleGroups = topicCatalog.filter((group) =>
    subjects.length ? subjects.includes(group.id) : areas.includes(group.area)
  );

  topicInput.replaceChildren(new Option("Todos os assuntos", ""));
  for (const group of visibleGroups) {
    const optionGroup = document.createElement("optgroup");
    optionGroup.label = group.label;
    for (const topic of group.topics) {
      optionGroup.append(new Option(`${topic.label} (${topic.count})`, topic.label));
    }
    topicInput.append(optionGroup);
  }

  const values = [...topicInput.options].map((option) => option.value);
  topicInput.value = values.includes(previous) ? previous : "";
  pendingTopic = "";
  topicInput.disabled = visibleGroups.length === 0;
  const count = visibleGroups.reduce((sum, group) => sum + group.topics.length, 0);
  topicHelp.textContent = count
    ? `${count} assuntos disponíveis nas categorias selecionadas.`
    : "Escolha uma área ou disciplina para ver os assuntos catalogados.";
}

async function loadTopicCatalog() {
  try {
    const response = await fetch("/api/catalog");
    const data = await response.json();
    topicCatalog = data.groups || [];
    populateTopicOptions();
    updateUI();
  } catch {
    topicHelp.textContent = "Não foi possível carregar o catálogo de assuntos agora.";
  }
}

function selectedYears() {
  const from = Math.min(Number(yearFrom.value), Number(yearTo.value));
  const to = Math.max(Number(yearFrom.value), Number(yearTo.value));
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function updateUI() {
  const mode = form.elements.mode.value;
  const total = Math.max(1, Math.min(90, Number(totalInput.value) || 1));
  if (mode === "single" && total !== 1) {
    totalInput.value = 1;
    balanceDistribution(1);
  }
  const distributed = totalDistributed();
  const isValid = distributed === Number(totalInput.value);
  totalWarning.textContent = isValid ? `Total: ${distributed}` : `${distributed} de ${totalInput.value}`;
  totalWarning.classList.toggle("invalid", !isValid);
  summaryTotal.textContent = `${totalInput.value} ${Number(totalInput.value) === 1 ? "questão" : "questões"}`;

  const years = selectedYears();
  const areas = selectedAreas();
  const subjects = selectedSubjects();
  const topic = topicInput.value.trim();
  yearCount.textContent = `${years.length} ${years.length === 1 ? "edição selecionada" : "edições selecionadas"}`;
  const areaText = areas.length === 4 ? "Todas as áreas" : areas.map((area) => areaShortLabels[area]).join(", ") || "Nenhuma área";
  const focusText = topic || (subjects.length ? subjects.map((subject) => subjectLabels[subject]).join(", ") : areaText);
  summaryDetails.textContent = `${years[0]}${years.length > 1 ? `–${years.at(-1)}` : ""} · ${focusText}`;

  document.querySelectorAll("[data-area-group]").forEach((group) => {
    const enabled = areas.includes(group.dataset.areaGroup);
    group.classList.toggle("disabled", !enabled);
  });

  document.querySelectorAll("#presets button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.total) === Number(totalInput.value));
  });
  for (const level of levels) {
    const item = document.querySelector(`[data-level="${level}"]`);
    const value = Number(item.querySelector("input").value) || 0;
    item.querySelector(".distribution-bar").style.setProperty("--width", `${total ? (value / total) * 100 : 0}%`);
  }
}

function balancedDistribution(total) {
  total = Math.max(1, Math.min(90, Number(total) || 1));
  const weights = [0.3, 0.4, 0.2, 0.1];
  const raw = weights.map((weight) => total * weight);
  const values = raw.map(Math.floor);
  let remaining = total - values.reduce((sum, value) => sum + value, 0);
  raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((first, second) => second.fraction - first.fraction)
    .forEach(({ index }) => {
      if (remaining > 0) {
        values[index] += 1;
        remaining -= 1;
      }
    });
  return Object.fromEntries(levels.map((level, index) => [level, values[index]]));
}

function balanceDistribution(total = Number(totalInput.value)) {
  const values = balancedDistribution(total);
  levels.forEach((level, index) => {
    document.querySelector(`[data-level="${level}"] input`).value = values[level];
  });
  updateUI();
}

function showToast(message, type = "") {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast show ${type}`.trim();
  toastTimer = setTimeout(() => (toast.className = "toast"), 4200);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanQuestionText(value = "") {
  return String(value)
    .replace(/!\[[^\]]*\]\((?:https?:\/\/)?[^)]+\)/gi, "")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/)?[^)]+\)/gi, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatMathExpression(expression) {
  return expression
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/_\{([^}]+)\}/g, "<sub>$1</sub>")
    .replace(/_([A-Za-z0-9]+)/g, "<sub>$1</sub>")
    .replace(/\^\{([^}]+)\}/g, "<sup>$1</sup>")
    .replace(/\^([A-Za-z0-9+-]+)/g, "<sup>$1</sup>")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\([A-Za-z]+)/g, "$1");
}

function formatQuestionText(value = "") {
  let formatted = escapeHtml(cleanQuestionText(value));
  formatted = formatted.replace(/\$([^$\n]+)\$/g, (_, expression) =>
    `<span class="math-inline">${formatMathExpression(expression)}</span>`
  );
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return formatted.replace(/\r?\n/g, "<br>");
}

function imageMarkup(url, className, alt) {
  if (!url) return "";
  return `
    <figure class="media-frame ${className}-frame">
      <img class="${className}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" />
      <figcaption>${escapeHtml(alt)}</figcaption>
    </figure>
  `;
}

function bindImageFallbacks() {
  questionList.querySelectorAll(".media-frame img").forEach((image) => {
    const showFallback = () => {
      const frame = image.closest(".media-frame");
      if (!frame) return;
      frame.classList.add("media-unavailable");
      frame.innerHTML = `<span>Figura temporariamente indisponível</span>`;
    };
    image.addEventListener("error", showFallback, { once: true });
    if (image.complete && image.naturalWidth === 0) showFallback();
  });
}

function renderQuestion(question) {
  const context = question.context || question.contextLocal || "";
  const alternatives = (question.alternatives || []).map((alternative) => `
    <button
      type="button"
      class="alternative"
      data-question-order="${question.order}"
      data-alternative-letter="${escapeHtml(alternative.letter)}"
      aria-pressed="false"
      aria-label="Selecionar alternativa ${escapeHtml(alternative.letter)} da questão ${question.order}"
    >
      <span class="alternative-letter">${escapeHtml(alternative.letter)}</span>
      <div>
        ${alternative.text ? `<p>${formatQuestionText(alternative.text)}</p>` : ""}
        ${imageMarkup(alternative.image, "alternative-image", `Imagem da alternativa ${alternative.letter}`)}
      </div>
    </button>
  `).join("");
  const skill = question.skill?.code ? ` · ${escapeHtml(question.skill.code)}` : "";
  const b = Number.isFinite(Number(question.param_b)) ? ` · b ${Number(question.param_b).toFixed(2).replace(".", ",")}` : "";
  const curriculum = [question.subjectLabel, ...(question.topicLabels || [])].filter(Boolean);
  const uniqueCurriculum = [...new Set(curriculum)];
  const curriculumLabel = uniqueCurriculum.length ? ` · ${escapeHtml(uniqueCurriculum.join(" · "))}` : "";
  const printMeta = [
    `ENEM ${question.year}`,
    question.areaLabel,
    ...uniqueCurriculum,
    question.index ? `Questão ${question.index} na prova original` : null
  ].filter(Boolean).join(" - ");
  return `
    <article class="question-card" data-question-order="${question.order}">
      <header class="question-meta">
        <div class="screen-question-meta">
          <span class="question-number">${question.order}</span>
          <span>ENEM ${question.year}</span>
          <span>·</span>
          <span>${escapeHtml(question.areaLabel)}</span>
          <span>${skill}${b}${curriculumLabel}</span>
          <span class="difficulty-pill ${question.difficulty}">${levelLabels[question.difficulty]}</span>
        </div>
        <div class="print-question-meta">${escapeHtml(printMeta)}</div>
      </header>
      <div class="question-body">
        <div class="question-context">${formatQuestionText(context)}</div>
        ${imageMarkup(question.image, "question-image", `Figura da questão ${question.order}`)}
        <div class="question-intro">${formatQuestionText(question.alternativesIntroduction || "")}</div>
        <div class="alternatives">${alternatives}</div>
      </div>
    </article>
  `;
}

function updateSelectionUI() {
  const total = currentQuestions.length;
  const answered = selectedAnswers.size;
  if (selectionProgress) {
    selectionProgress.textContent = total
      ? `${answered} de ${total} ${total === 1 ? "questão respondida" : "questões respondidas"}`
      : "0 respondidas";
  }
  if (clearAnswersButton) clearAnswersButton.disabled = answered === 0;

  const questionByOrder = new Map(currentQuestions.map((question) => [String(question.order), question]));
  questionList.querySelectorAll(".question-card").forEach((card) => {
    card.classList.toggle("answered", selectedAnswers.has(card.dataset.questionOrder));
  });
  questionList.querySelectorAll(".alternative").forEach((button) => {
    const order = button.dataset.questionOrder;
    const letter = button.dataset.alternativeLetter;
    const selected = selectedAnswers.get(order) === letter;
    const question = questionByOrder.get(order);
    const correct = question?.correctAlternative;
    button.classList.toggle("selected", selected);
    button.classList.toggle("answer-visible", answersVisible);
    button.classList.toggle("correct", answersVisible && correct === letter);
    button.classList.toggle("wrong", answersVisible && selected && correct && correct !== letter);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });

  answerGrid.querySelectorAll(".answer-item").forEach((item) => {
    const chosen = selectedAnswers.get(item.dataset.answerOrder);
    const question = questionByOrder.get(item.dataset.answerOrder);
    item.classList.toggle("answered", Boolean(chosen));
    item.classList.toggle("user-correct", Boolean(chosen && question?.correctAlternative === chosen));
    item.classList.toggle("user-wrong", Boolean(chosen && question?.correctAlternative && question.correctAlternative !== chosen));
    const userAnswer = item.querySelector(".user-answer");
    if (userAnswer) userAnswer.textContent = chosen ? `Sua: ${chosen}` : "Sua: —";
  });
}

function renderResults(data) {
  currentQuestions = data.questions;
  selectedAnswers = new Map();
  answersVisible = false;
  questionList.innerHTML = data.questions.map(renderQuestion).join("");
  bindImageFallbacks();
  answerGrid.innerHTML = data.questions.map((question) => `
    <div class="answer-item" data-answer-order="${question.order}">
      <span>${question.order}</span>
      <b>${escapeHtml(question.correctAlternative || "—")}</b>
      <small class="user-answer">Sua: —</small>
    </div>
  `).join("");
  answerGrid.classList.add("answers-hidden");
  document.querySelector("#toggle-answers").textContent = "Mostrar respostas";
  updateSelectionUI();

  const count = data.questions.length;
  const years = [...new Set(data.questions.map((question) => question.year))].sort();
  resultsTitle.textContent = count === 1 ? "Sua questão está pronta" : `Seu simulado com ${count} questões`;
  const focus = data.filters?.topic || data.filters?.subjects?.join(", ");
  resultsSubtitle.textContent = `${years[0]}${years.length > 1 ? `–${years.at(-1)}` : ""}${focus ? ` · ${focus}` : ""} · dificuldade TRI relativa · imagens preservadas`;
  printCoverMeta.textContent = focus || "Simulado geral";
  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function payloadFromForm() {
  const dist = distribution();
  return {
    expectedTotal: Number(totalInput.value),
    years: selectedYears(),
    areas: selectedAreas(),
    subjects: selectedSubjects(),
    topic: topicInput.value.trim(),
    language: form.elements.language.value,
    distribution: dist,
    seed: `${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`
  };
}

async function generate(payload = payloadFromForm()) {
  const requestedTotal = Object.values(payload.distribution || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (requestedTotal < 1 || requestedTotal > 90 || (payload.expectedTotal && requestedTotal !== payload.expectedTotal)) {
    showToast("A distribuição por nível precisa somar a quantidade total.", "error");
    return;
  }
  if (!selectedAreas().length) {
    showToast("Escolha pelo menos uma área do conhecimento.", "error");
    return;
  }
  lastPayload = payload;
  loading.hidden = false;
  try {
    const response = await fetch("/api/questions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.availability) {
        const available = levels.map((level) => `${levelLabels[level]}: ${data.availability[level] || 0}`).join(" · ");
        throw new Error(`${data.error} Disponíveis: ${available}.`);
      }
      throw new Error(data.error || "Não foi possível montar o caderno.");
    }
    renderResults(data);
    try {
      localStorage.setItem("prisma-config", JSON.stringify({
        version: 4,
        years: payload.years,
        areas: payload.areas,
        subjects: payload.subjects,
        topic: payload.topic,
        language: payload.language,
        distribution: payload.distribution
      }));
    } catch {}
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    loading.hidden = true;
  }
}

function restoreConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem("prisma-config"));
    if (!saved || saved.version !== 4) return;
    if (saved.years?.length) {
      yearFrom.value = Math.min(...saved.years);
      yearTo.value = Math.max(...saved.years);
    }
    document.querySelectorAll('input[name="area"]').forEach((input) => {
      input.checked = saved.areas?.includes(input.value) ?? true;
    });
    document.querySelectorAll('input[name="subject"]').forEach((input) => {
      input.checked = saved.subjects?.includes(input.value) ?? false;
    });
    topicInput.value = saved.topic || "";
    pendingTopic = saved.topic || "";
    if (saved.language) form.elements.language.value = saved.language;
    if (saved.distribution) {
      levels.forEach((level) => {
        document.querySelector(`[data-level="${level}"] input`).value = saved.distribution[level] || 0;
      });
      totalInput.value = Object.values(saved.distribution).reduce((sum, value) => sum + Number(value), 0);
    }
  } catch {}
}

populateYears();
restoreConfig();
updateUI();
loadTopicCatalog().then(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("generate") !== "1") return;
  const total = Math.max(1, Math.min(90, Number(params.get("total")) || 10));
  const area = params.get("area") || "ciencias-humanas";
  const subject = params.get("subject") || "";
  const topic = params.get("topic") || "";
  generate({
    years: Array.from({ length: 16 }, (_, index) => 2009 + index),
    areas: [area],
    subjects: subject ? [subject] : [],
    topic,
    language: "ingles",
    distribution: balancedDistribution(total),
    seed: params.get("seed") || "url-preset"
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  generate();
});
document.querySelector("#presets").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-total]");
  if (!button) return;
  totalInput.value = button.dataset.total;
  balanceDistribution(Number(button.dataset.total));
});
document.querySelector("#balance-button").addEventListener("click", () => balanceDistribution());
document.querySelector("#difficulty-grid").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const input = button.closest(".difficulty-item").querySelector("input");
  const delta = button.dataset.action === "plus" ? 1 : -1;
  input.value = Math.max(0, Math.min(90, Number(input.value) + delta));
  updateUI();
});
document.querySelectorAll("#difficulty-grid input, #total-input, #year-from, #year-to, #topic-input, input[name='area'], input[name='subject'], input[name='language'], input[name='mode']").forEach((input) => {
  input.addEventListener("change", () => {
    if (input.name === "mode" && input.value === "single" && input.checked) {
      totalInput.value = 1;
      balanceDistribution(1);
    } else if (input.name === "mode" && input.value === "booklet" && input.checked && Number(totalInput.value) === 1) {
      totalInput.value = 40;
      balanceDistribution(40);
    } else if (input.name === "subject" && input.checked) {
      const parentArea = document.querySelector(`input[name="area"][value="${input.dataset.area}"]`);
      if (parentArea) parentArea.checked = true;
    } else if (input.name === "area" && !input.checked) {
      document.querySelectorAll(`input[name="subject"][data-area="${input.value}"]`).forEach((subject) => {
        subject.checked = false;
      });
    }
    if (input.name === "area" || input.name === "subject") populateTopicOptions();
    updateUI();
  });
  input.addEventListener("input", updateUI);
});
document.querySelector("#toggle-answers").addEventListener("click", (event) => {
  answersVisible = answerGrid.classList.toggle("answers-hidden") === false;
  event.currentTarget.textContent = answersVisible ? "Ocultar respostas" : "Mostrar respostas";
  updateSelectionUI();
});
questionList.addEventListener("click", (event) => {
  const button = event.target.closest(".alternative");
  if (!button) return;
  const order = button.dataset.questionOrder;
  const letter = button.dataset.alternativeLetter;
  if (selectedAnswers.get(order) === letter) {
    selectedAnswers.delete(order);
  } else {
    selectedAnswers.set(order, letter);
  }
  updateSelectionUI();
});
clearAnswersButton.addEventListener("click", () => {
  selectedAnswers = new Map();
  updateSelectionUI();
});
document.querySelector("#print-button").addEventListener("click", () => {
  if (!currentQuestions.length) return;
  window.print();
});
document.querySelector("#regenerate-button").addEventListener("click", () => {
  if (!lastPayload) return generate();
  generate({ ...lastPayload, seed: `${Date.now()}-${Math.random()}` });
});
