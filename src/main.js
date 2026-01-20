// src/main.js
import { QUIZ } from "./quiz.js";

/* =========================
   CONFIGURAÇÕES GERAIS
========================= */

const isLocal =
  location.hostname === "127.0.0.1" || location.hostname === "localhost";

const API_URL = isLocal
  ? "http://127.0.0.1:8000/generate-question"
  : "https://treino-hero-ia-backend.onrender.com/generate-question";

const XP_PER_CORRECT = 10;
const XP_PER_LEVEL = 100;
const CHALLENGE_DURATION = 60;
const CHALLENGE_LIVES_START = 3;

/* =========================
   ESTADO GLOBAL
========================= */

const initialState = {
  mode: "classic", // classic | ia | challenge
  level: 1,
  xp: 0,
  correct: 0,
  bestXp: 0,
  streak: 0,
  bestStreak: 0,
  lives: CHALLENGE_LIVES_START,
  questionIndex: 0,
  currentQuestion: null,
  difficulty: "medium",
  iaTheme: "fisiologia",
};

let state = { ...initialState };

let challengeTimer = null;
let timeLeft = CHALLENGE_DURATION;

/* =========================
   REFERÊNCIAS DO DOM
========================= */

let levelEl, xpTextEl, xpFillEl, correctEl, bestXpEl;
let challengeHudEl, chTimerEl, chLivesEl, chStreakEl, chBestStreakEl;
let questionEl, choicesEl, explanationEl;
let btnClassic, btnIA, btnChallenge, btnRanking;
let diffButtons, iaThemeSelect;
let rankingModal, closeRankingBtn, rankingList;

function setupDomRefs() {
  // HUD
  levelEl = document.getElementById("hud-level-value");
  xpTextEl = document.getElementById("hud-xp-text");
  xpFillEl = document.getElementById("hud-xp-fill");
  correctEl = document.getElementById("hud-correct");
  bestXpEl = document.getElementById("hud-best-xp");

  // HUD desafio
  challengeHudEl = document.getElementById("challenge-hud");
  chTimerEl = document.getElementById("ch-timer");
  chLivesEl = document.getElementById("ch-lives");
  chStreakEl = document.getElementById("ch-streak");
  chBestStreakEl = document.getElementById("ch-best-streak");

  // Pergunta
  questionEl = document.getElementById("question");
  choicesEl = document.getElementById("choices");
  explanationEl = document.getElementById("explanation");

  // Botões de modo
  btnClassic = document.getElementById("mode-classic");
  btnIA = document.getElementById("mode-ia");
  btnChallenge = document.getElementById("mode-challenge");
  btnRanking = document.getElementById("btn-ranking");

  // Dificuldade e IA
  diffButtons = Array.from(document.querySelectorAll(".difficulty-tab"));
  iaThemeSelect = document.getElementById("ia-theme");

  // Ranking modal
  rankingModal = document.getElementById("ranking-modal");
  closeRankingBtn = document.getElementById("close-ranking");
  rankingList = document.getElementById("ranking-list");
}

/* =========================
   UI HELPERS (ACTIVE / ENABLE)
========================= */

function setActiveModeButton(mode) {
  const btns = [btnClassic, btnIA, btnChallenge];
  btns.forEach((b) => b && b.classList.remove("active"));

  if (mode === "classic" && btnClassic) btnClassic.classList.add("active");
  if (mode === "ia" && btnIA) btnIA.classList.add("active");
  if (mode === "challenge" && btnChallenge) btnChallenge.classList.add("active");
}

function syncDifficultyUI() {
  if (!diffButtons) return;
  diffButtons.forEach((b) => b.classList.remove("active"));

  const active = diffButtons.find((b) => b.dataset.diff === state.difficulty);
  if (active) active.classList.add("active");
}

function toggleIAControls() {
  const isIA = state.mode === "ia";

  // Tema só faz sentido no modo IA
  if (iaThemeSelect) iaThemeSelect.disabled = !isIA;

  // Dificuldade: se você quer que só mude no IA, deixa assim:
  if (diffButtons && diffButtons.length) {
    diffButtons.forEach((b) => (b.disabled = !isIA));
  }
}

/* =========================
   PERSISTÊNCIA
========================= */

function saveState() {
  try {
    localStorage.setItem("treinoHero_v2", JSON.stringify(state));
  } catch (err) {
    console.warn("Não foi possível salvar o estado:", err);
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem("treinoHero_v2");
    if (saved) {
      const parsed = JSON.parse(saved);
      state = { ...initialState, ...parsed };
    }
  } catch (err) {
    console.warn("Não foi possível carregar o estado salvo:", err);
    state = { ...initialState };
  }
}

/* =========================
   HUD
========================= */

function updateHUD() {
  try {
    setupDomRefs();

    if (levelEl) levelEl.textContent = state.level;
    if (xpTextEl) xpTextEl.textContent = `${state.xp} / ${XP_PER_LEVEL}`;
    if (xpFillEl) {
      const pct = Math.min(100, (state.xp / XP_PER_LEVEL) * 100);
      xpFillEl.style.width = `${pct}%`;
    }

    if (correctEl) correctEl.textContent = state.correct;
    if (bestXpEl) bestXpEl.textContent = state.bestXp;

    if (challengeHudEl) {
      if (state.mode === "challenge") challengeHudEl.classList.add("active");
      else challengeHudEl.classList.remove("active");
    }

    if (chTimerEl) chTimerEl.textContent = `${timeLeft}s`;
    if (chLivesEl) chLivesEl.textContent = "❤".repeat(state.lives);
    if (chStreakEl) chStreakEl.textContent = state.streak;
    if (chBestStreakEl) chBestStreakEl.textContent = state.bestStreak;
  } catch (err) {
    console.error("[Treino Hero] Erro no updateHUD:", err);
  }
}

/* =========================
   NORMALIZAÇÃO DE PERGUNTA
========================= */

function normalizeQuestion(raw) {
  if (!raw || typeof raw !== "object") return null;

  const question =
    raw.question ?? raw.pergunta ?? raw.title ?? raw.enunciado ?? null;

  const options =
    raw.options ??
    raw.choices ??
    raw.alternatives ??
    raw.alternativas ??
    raw.answers ??
    null;

  const correctIndex =
    raw.correctIndex ??
    raw.correct_index ??
    raw.answerIndex ??
    raw.correct ??
    raw.correta ??
    null;

  const explanation =
    raw.explanation ?? raw.explicacao ?? raw.justificativa ?? "";

  if (!question || !Array.isArray(options) || options.length < 2) return null;

  const ci = Number(correctIndex);
  const fixedCorrectIndex = Number.isFinite(ci) ? ci : 0;

  return {
    question,
    options,
    correctIndex: fixedCorrectIndex,
    explanation,
  };
}

/* =========================
   PERGUNTAS
========================= */

function getClassicQuestion() {
  if (!Array.isArray(QUIZ) || QUIZ.length === 0) return null;

  const index = state.questionIndex % QUIZ.length;
  return normalizeQuestion(QUIZ[index]);
}

async function getIAQuestion() {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: state.iaTheme,
        difficulty: state.difficulty,
      }),
    });

    if (!response.ok) throw new Error(`Erro do backend (${response.status})`);

    const data = await response.json();

    return normalizeQuestion({
      question: data.question,
      options: data.options,
      correctIndex: data.correct_index,
      explanation: data.explanation || "",
    });
  } catch (err) {
    console.error("Erro ao buscar pergunta IA:", err);
    return null;
  }
}

/* =========================
   RENDERIZAÇÃO
========================= */

function showErrorOnScreen(msg) {
  setupDomRefs();
  if (!questionEl || !choicesEl) return;
  questionEl.textContent = msg;
  choicesEl.innerHTML = "";
}

async function renderQuestion() {
  setupDomRefs();

  if (!questionEl || !choicesEl) {
    console.warn("[Treino Hero] Elementos #question/#choices não encontrados.");
    return;
  }

  questionEl.textContent = "";
  choicesEl.innerHTML = "";
  if (explanationEl) explanationEl.textContent = "";

  let q = null;

  if (state.mode === "ia") {
    showErrorOnScreen("Acordando a IA... (pode demorar alguns segundos)");
    q = await getIAQuestion();

    if (!q) {
      showErrorOnScreen(
        "IA indisponível agora (Render pode estar dormindo). Tente de novo em alguns segundos."
      );
      return;
    }
  } else {
    q = getClassicQuestion();
  }

  if (!q) {
    showErrorOnScreen(
      "Nenhuma pergunta disponível. Verifique se src/quiz.js exporta QUIZ corretamente."
    );
    return;
  }

  state.currentQuestion = q;
  questionEl.textContent = q.question;

  q.options.forEach((opt, index) => {
    const btn = document.createElement("button");
    btn.textContent = String(opt);
    btn.className = "choice-btn";
    btn.addEventListener("click", () => handleAnswer(index));
    choicesEl.appendChild(btn);
  });
}

/* =========================
   RESPOSTA
========================= */

function handleAnswer(index) {
  const q = state.currentQuestion;
  if (!q) return;

  const correct = q.correctIndex === index;

  if (correct) {
    state.correct += 1;
    state.xp += XP_PER_CORRECT;
    state.streak += 1;

    if (state.xp >= XP_PER_LEVEL) {
      state.level += 1;
      state.xp = 0;
    }

    if (state.xp > state.bestXp) state.bestXp = state.xp;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
  } else {
    state.streak = 0;

    if (state.mode === "challenge") {
      state.lives -= 1;
      if (state.lives <= 0) {
        endChallenge();
        return;
      }
    }
  }

  if (explanationEl) explanationEl.textContent = q.explanation || "";

  state.questionIndex += 1;
  saveState();
  updateHUD();

  setTimeout(() => renderQuestion(), 600);
}

/* =========================
   MODOS
========================= */

function setMode(mode) {
  state.mode = mode;
  state.questionIndex = 0;
  state.streak = 0;

  clearInterval(challengeTimer);
  timeLeft = CHALLENGE_DURATION;
  state.lives = CHALLENGE_LIVES_START;

  if (mode === "challenge") startChallenge();

  saveState();

  // ✅ atualiza UI e controles
  setActiveModeButton(mode);
  toggleIAControls();
  syncDifficultyUI();

  updateHUD();
  renderQuestion();
}

function startChallenge() {
  timeLeft = CHALLENGE_DURATION;
  state.lives = CHALLENGE_LIVES_START;

  challengeTimer = setInterval(() => {
    timeLeft -= 1;
    if (timeLeft < 0) timeLeft = 0;

    updateHUD();

    if (timeLeft <= 0) endChallenge();
  }, 1000);
}

function endChallenge() {
  clearInterval(challengeTimer);
  alert("Fim do modo desafio! 💪");
  setMode("classic");
}

/* =========================
   DIFICULDADE / TEMA IA
========================= */

function setupDifficulty() {
  if (!diffButtons) return;

  diffButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // se estiver travado fora do IA, não faz nada
      if (btn.disabled) return;

      diffButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      state.difficulty = btn.dataset.diff || "medium";
      saveState();

      // ✅ se estiver no modo IA, recarrega pergunta
      if (state.mode === "ia") renderQuestion();
    });
  });

  // garante UI conforme estado atual
  syncDifficultyUI();
}

function setupIATheme() {
  if (!iaThemeSelect) return;

  iaThemeSelect.value = state.iaTheme;

  iaThemeSelect.addEventListener("change", () => {
    if (iaThemeSelect.disabled) return;

    state.iaTheme = iaThemeSelect.value;
    saveState();

    // ✅ se estiver no modo IA, recarrega pergunta
    if (state.mode === "ia") renderQuestion();
  });
}

/* =========================
   RANKING
========================= */

function setupRanking() {
  if (!btnRanking || !rankingModal || !closeRankingBtn || !rankingList) return;

  btnRanking.addEventListener("click", () => {
    rankingList.innerHTML = "";
    const item = document.createElement("li");
    item.textContent = `Você — Level ${state.level}, XP ${state.xp}, melhor streak ${state.bestStreak}`;
    rankingList.appendChild(item);

    rankingModal.classList.remove("hidden");
  });

  closeRankingBtn.addEventListener("click", () => {
    rankingModal.classList.add("hidden");
  });
}

/* =========================
   EVENTOS
========================= */

function setupModeButtons() {
  if (btnClassic) btnClassic.addEventListener("click", () => setMode("classic"));
  if (btnIA) btnIA.addEventListener("click", () => setMode("ia"));
  if (btnChallenge)
    btnChallenge.addEventListener("click", () => setMode("challenge"));
}

/* =========================
   INIT
========================= */

function initGame() {
  setupDomRefs();
  loadState();

  setupModeButtons();
  setupDifficulty();
  setupIATheme();
  setupRanking();

  // ✅ sincroniza UI com estado salvo
  setActiveModeButton(state.mode);
  toggleIAControls();
  syncDifficultyUI();

  updateHUD();
  renderQuestion();
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    initGame();
  } catch (err) {
    console.error("Erro na inicialização do Treino Hero:", err);
  }
});
