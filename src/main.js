// src/main.js
import { QUIZ } from "./quiz.js";

// -------- CONSTANTES --------
const XP_PER_CORRECT = 10;
const XP_PER_LEVEL = 100;
const STORAGE_KEY = "treinoHero_stats";
const CHALLENGE_DURATION = 60; // segundos
const CHALLENGE_LIVES_START = 3;
const RANKING_KEY = "treinoHero_ranking";

// -------- ESTADO GLOBAL --------
let _state = {};
let challengeInterval = null;

function getState() {
  return _state;
}

function setState(newState) {
  _state = { ..._state, ...newState };
}

// -------- ELEMENTOS DO DOM --------
const cardEl = document.querySelector("[data-card]");
const questionEl = document.getElementById("question");
const choicesEl = document.getElementById("choices");
const explanationEl = document.getElementById("explanation");

const modeClassicBtn = document.getElementById("mode-classic");
const modeIABtn = document.getElementById("mode-ia");
const modeChallengeBtn = document.getElementById("mode-challenge");
const btnRanking = document.getElementById("btn-ranking");

const iaControls = document.querySelector(".ia-controls");
const iaThemeSelect = document.getElementById("ia-theme");
const difficultyTabs = document.querySelectorAll(".difficulty-tab");

const hudLevelValue = document.getElementById("hud-level-value");
const hudXpText = document.getElementById("hud-xp-text");
const hudXpFill = document.getElementById("hud-xp-fill");
const hudCorrect = document.getElementById("hud-correct");
const hudBestXp = document.getElementById("hud-best-xp");

const challengeHud = document.getElementById("challenge-hud");
const chTimer = document.getElementById("ch-timer");
const chLives = document.getElementById("ch-lives");
const chStreak = document.getElementById("ch-streak");
const chBestStreak = document.getElementById("ch-best-streak");

const levelUpBadge = document.getElementById("level-up-badge");

const rankingModal = document.getElementById("ranking-modal");
const rankingListEl = document.getElementById("ranking-list");
const closeRankingBtn = document.getElementById("close-ranking");

// -------- STORAGE: STATS --------
function loadStatsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveStatsToStorage() {
  const { xp, bestXp, correct, bestStreak } = getState();
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ xp, bestXp, correct, bestStreak })
    );
  } catch {
    /* ignore */
  }
}

// -------- STORAGE: RANKING --------
function loadRanking() {
  try {
    const raw = localStorage.getItem(RANKING_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveRanking(ranking) {
  try {
    localStorage.setItem(RANKING_KEY, JSON.stringify(ranking));
  } catch {
    /* ignore */
  }
}

function addScoreToRanking(xp) {
  const ranking = loadRanking();
  ranking.push({
    xp,
    date: new Date().toLocaleString("pt-BR"),
  });
  ranking.sort((a, b) => b.xp - a.xp);
  saveRanking(ranking.slice(0, 10));
}

function renderRanking() {
  const ranking = loadRanking();
  if (!ranking.length) {
    rankingListEl.innerHTML =
      "<li>Nenhum resultado ainda. Jogue para entrar no ranking!</li>";
    return;
  }

  rankingListEl.innerHTML = ranking
    .map(
      (item, idx) => `
      <li>
        <strong>${idx + 1}º</strong> — ${item.xp} XP
        <small>${item.date}</small>
      </li>`
    )
    .join("");
}

// -------- ESTADO INICIAL --------
const saved = loadStatsFromStorage();

setState({
  mode: "classic",
  difficulty: "medium",
  perguntaIndex: 0,
  perguntaAtual: QUIZ[0],
  xp: saved?.xp || 0,
  level: 1 + Math.floor((saved?.xp || 0) / XP_PER_LEVEL),
  correct: saved?.correct || 0,
  bestXp: saved?.bestXp || 0,
  challengeTime: CHALLENGE_DURATION,
  challengeLives: CHALLENGE_LIVES_START,
  streak: 0,
  bestStreak: saved?.bestStreak || 0,
});

iaControls.style.display = "none";
challengeHud.style.display = "none";

// -------- POOL POR DIFICULDADE --------
function getQuizPool() {
  const { difficulty } = getState();
  // fallback: se a questão não tiver difficulty, assume "medium"
  const pool = QUIZ.filter((q) => (q.difficulty || "medium") === difficulty);
  return pool.length ? pool : QUIZ;
}

// -------- HUD --------
function renderHUD() {
  const { xp, correct, bestXp } = getState();
  const level = 1 + Math.floor(xp / XP_PER_LEVEL);
  const currentLevelXp = xp % XP_PER_LEVEL;
  const progress = Math.min(1, currentLevelXp / XP_PER_LEVEL);

  hudLevelValue.textContent = level;
  hudXpText.textContent = `${currentLevelXp} / ${XP_PER_LEVEL}`;
  hudXpFill.style.width = `${progress * 100}%`;
  hudCorrect.textContent = correct;
  hudBestXp.textContent = bestXp;
}

function renderChallengeHUD() {
  const { challengeTime, challengeLives, streak, bestStreak } = getState();
  chTimer.textContent = `${challengeTime}s`;
  chLives.textContent = "❤".repeat(challengeLives);
  chStreak.textContent = streak;
  chBestStreak.textContent = bestStreak;
}

// -------- LEVEL UP BADGE --------
function triggerLevelUp() {
  if (!levelUpBadge) return;

  levelUpBadge.classList.remove("hidden");
  // força reflow para resetar animação
  // eslint-disable-next-line no-unused-expressions
  levelUpBadge.offsetHeight;
  levelUpBadge.classList.add("show");

  setTimeout(() => {
    levelUpBadge.classList.remove("show");
    setTimeout(() => levelUpBadge.classList.add("hidden"), 300);
  }, 1200);
}

// -------- DIFICULDADE (tabs) --------
difficultyTabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    const diff = btn.dataset.diff;

    difficultyTabs.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    setState({ difficulty: diff, perguntaIndex: 0 });

    const mode = getState().mode;
    if (mode === "classic" || mode === "challenge") {
      const pool = getQuizPool();
      setState({ perguntaAtual: pool[0] || QUIZ[0] });
      renderPergunta();
    } else if (mode === "ia") {
      carregarPerguntaIA();
    }
  });
});

// -------- TROCA DE MODO --------
function stopChallengeTimer() {
  if (challengeInterval) {
    clearInterval(challengeInterval);
    challengeInterval = null;
  }
}

function clearModeActive() {
  modeClassicBtn.classList.remove("active");
  modeIABtn.classList.remove("active");
  modeChallengeBtn.classList.remove("active");
}

modeClassicBtn.addEventListener("click", () => {
  stopChallengeTimer();
  clearModeActive();
  modeClassicBtn.classList.add("active");

  iaControls.style.display = "none";
  challengeHud.style.display = "none";

  const pool = getQuizPool();
  setState({
    mode: "classic",
    perguntaIndex: 0,
    perguntaAtual: pool[0] || QUIZ[0],
  });

  renderPergunta();
});

modeIABtn.addEventListener("click", async () => {
  stopChallengeTimer();
  clearModeActive();
  modeIABtn.classList.add("active");

  iaControls.style.display = "flex";
  challengeHud.style.display = "none";

  setState({ mode: "ia" });
  await carregarPerguntaIA();
});

modeChallengeBtn.addEventListener("click", () => {
  clearModeActive();
  modeChallengeBtn.classList.add("active");

  iaControls.style.display = "none";
  challengeHud.style.display = "flex";

  iniciarModoDesafio();
});

// -------- MODO DESAFIO --------
function iniciarModoDesafio() {
  stopChallengeTimer();

  const pool = getQuizPool();
  setState({
    mode: "challenge",
    perguntaIndex: 0,
    perguntaAtual: pool[0] || QUIZ[0],
    challengeTime: CHALLENGE_DURATION,
    challengeLives: CHALLENGE_LIVES_START,
    streak: 0,
  });

  renderPergunta();
  renderChallengeHUD();

  challengeInterval = setInterval(() => {
    const { challengeTime, challengeLives } = getState();
    if (challengeTime <= 1 || challengeLives <= 0) {
      finalizarModoDesafio();
      return;
    }
    setState({ challengeTime: challengeTime - 1 });
    renderChallengeHUD();
  }, 1000);
}

function finalizarModoDesafio() {
  stopChallengeTimer();
  const { streak, bestStreak } = getState();

  if (streak > bestStreak) {
    setState({ bestStreak: streak });
    saveStatsToStorage();
  }

  renderChallengeHUD();
  explanationEl.textContent =
    `Fim do Modo Desafio!\n` +
    `Streak atual: ${streak}\n` +
    `Seu melhor streak: ${getState().bestStreak}\n\n` +
    `Clique em "Modo Desafio" para recomeçar ou mude de modo.`;
}

// -------- BACKEND IA (RAG: tema + dificuldade) --------

// ✅ API dinâmica para LOCALHOST + RENDER
const isLocal =
  location.hostname === "127.0.0.1" || location.hostname === "localhost";

const API_BASE = isLocal
  ? "http://127.0.0.1:8000"
  : "https://treino-hero-ia-backend.onrender.com";

async function fetchIAQuestion(tema, difficulty) {
  const res = await fetch(`${API_BASE}/generate-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tema, difficulty }),
  });

  if (!res.ok) throw new Error("Erro ao buscar pergunta da IA");

  return res.json();
}

function mapIAQuestion(qIA) {
  return {
    q: qIA.question,
    options: qIA.options,
    answer: qIA.correctIndex,
    explain: qIA.explanation,
    source: qIA.source,
  };
}

async function carregarPerguntaIA() {
  if (cardEl) cardEl.classList.add("loading");
  try {
    const tema = iaThemeSelect.value;
    const { difficulty } = getState();
    const qIA = await fetchIAQuestion(tema, difficulty);

    setState({ perguntaAtual: mapIAQuestion(qIA) });
    renderPergunta();
  } catch (e) {
    console.error(e);
    questionEl.textContent = "Erro ao gerar pergunta IA.";
    choicesEl.innerHTML = "";
    explanationEl.textContent = "";
  } finally {
    if (cardEl) cardEl.classList.remove("loading");
  }
}

// -------- RESPONDER --------
function responder(index) {
  const state = getState();
  const pergunta = state.perguntaAtual;
  const buttons = Array.from(choicesEl.querySelectorAll(".choice-btn"));

  buttons.forEach((btn) => btn.classList.add("disabled"));

  const clicked = buttons[index];
  const correctBtn = buttons[pergunta.answer];

  const isCorrect = index === pergunta.answer;

  if (isCorrect) {
    clicked.classList.add("correct");

    const newXp = state.xp + XP_PER_CORRECT;
    const newLevel = 1 + Math.floor(newXp / XP_PER_LEVEL);
    const newCorrect = state.correct + 1;
    const newBestXp = Math.max(state.bestXp, newXp);

    if (newLevel > state.level) triggerLevelUp();

    setState({
      xp: newXp,
      level: newLevel,
      correct: newCorrect,
      bestXp: newBestXp,
    });

    addScoreToRanking(newXp);

    if (state.mode === "challenge") {
      const newStreak = state.streak + 1;
      const newBestStreak = Math.max(state.bestStreak, newStreak);
      setState({ streak: newStreak, bestStreak: newBestStreak });
    }

    saveStatsToStorage();
    renderHUD();
  } else {
    clicked.classList.add("wrong");
    if (correctBtn) correctBtn.classList.add("correct");

    if (state.mode === "challenge") {
      const newLives = Math.max(0, state.challengeLives - 1);
      setState({ challengeLives: newLives, streak: 0 });
    }
  }

  let texto = pergunta.explain || "";
  if (pergunta.source) {
    const { apostila, page } = pergunta.source;
    texto += `\n\nFonte: ${apostila || "apostila"}${
      page ? ` (página ~${page})` : ""
    }`;
  }
  explanationEl.textContent = texto;

  if (state.mode === "challenge") {
    renderChallengeHUD();
    const { challengeLives, challengeTime } = getState();
    if (challengeLives <= 0 || challengeTime <= 0) {
      setTimeout(() => finalizarModoDesafio(), 1200);
      return;
    }
  }

  setTimeout(() => proximaPergunta(), 1500);
}

// -------- PRÓXIMA PERGUNTA --------
function proximaPergunta() {
  const state = getState();

  if (state.mode === "classic" || state.mode === "challenge") {
    const pool = getQuizPool();
    const len = pool.length || QUIZ.length;
    const nextIndex = (state.perguntaIndex + 1) % len;
    const nextQuestion = pool[nextIndex] || QUIZ[nextIndex] || QUIZ[0];

    setState({
      perguntaIndex: nextIndex,
      perguntaAtual: nextQuestion,
    });

    renderPergunta();
  } else if (state.mode === "ia") {
    carregarPerguntaIA();
  }
}

// -------- RENDER PERGUNTA --------
function renderPergunta() {
  const { perguntaAtual } = getState();
  if (!perguntaAtual) return;

  choicesEl.innerHTML = "";
  explanationEl.textContent = "";

  questionEl.textContent = perguntaAtual.q;

  perguntaAtual.options.forEach((text, idx) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = text;
    btn.onclick = () => responder(idx);
    choicesEl.appendChild(btn);
  });

  renderHUD();
  renderChallengeHUD();
}

// -------- MODAL RANKING --------
btnRanking.addEventListener("click", () => {
  renderRanking();
  rankingModal.classList.remove("hidden");
});

closeRankingBtn.addEventListener("click", () => {
  rankingModal.classList.add("hidden");
});

// -------- INICIALIZAÇÃO --------
renderPergunta();
renderHUD();
renderChallengeHUD();
