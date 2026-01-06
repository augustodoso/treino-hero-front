// src/main.js
import { QUIZ } from "./quiz.js";

/* =========================
   CONFIGURAÇÕES GERAIS
========================= */

// Detecta ambiente (local x produção)
const isLocal =
  location.hostname === "127.0.0.1" || location.hostname === "localhost";

// URL do backend para o modo IA
const API_URL = isLocal
  ? "http://127.0.0.1:8000/generate-question"
  : "https://treino-hero-ia-backend.onrender.com/generate-question";

// Regras de XP / Level / Desafio
const XP_PER_CORRECT = 10;
const XP_PER_LEVEL = 100;
const CHALLENGE_DURATION = 60; // segundos
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

// HUD principal
let levelEl;
let xpTextEl;
let xpFillEl;
let correctEl;
let bestXpEl;

// HUD desafio
let challengeHudEl;
let chTimerEl;
let chLivesEl;
let chStreakEl;
let chBestStreakEl;

// Pergunta / opções / explicação
let questionEl;
let choicesEl;
let explanationEl;

// Botões de modo
let btnClassic;
let btnIA;
let btnChallenge;
let btnRanking;

// Dificuldade e IA
let diffButtons;
let iaThemeSelect;

// Modal ranking
let rankingModal;
let closeRankingBtn;
let rankingList;

function setupDomRefs() {
  // HUD principal
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

  // Modo de jogo
  btnClassic = document.getElementById("mode-classic");
  btnIA = document.getElementById("mode-ia");
  btnChallenge = document.getElementById("mode-challenge");
  btnRanking = document.getElementById("btn-ranking");

  // Dificuldade / IA
  diffButtons = Array.from(document.querySelectorAll(".difficulty-tab"));
  iaThemeSelect = document.getElementById("ia-theme");

  // Ranking
  rankingModal = document.getElementById("ranking-modal");
  closeRankingBtn = document.getElementById("close-ranking");
  rankingList = document.getElementById("ranking-list");
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
   HUD (LEVEL / XP / DESAFIO)
========================= */

function updateHUD() {
  // Garante que as refs existem (se vieram null por algum motivo)
  if (!levelEl && !xpTextEl && !xpFillEl) {
    setupDomRefs();
  }

  // HUD principal
  if (levelEl) {
    levelEl.textContent = state.level;
  }

  if (xpTextEl) {
    xpTextEl.textContent = `${state.xp} / ${XP_PER_LEVEL}`;
  }

  if (xpFillEl) {
    const pct = Math.min(100, (state.xp / XP_PER_LEVEL) * 100);
    xpFillEl.style.width = `${pct}%`;
  }

  if (correctEl) {
    correctEl.textContent = state.correct;
  }

  if (bestXpEl) {
    bestXpEl.textContent = state.bestXp;
  }

  // HUD desafio
  if (challengeHudEl) {
    if (state.mode === "challenge") {
      challengeHudEl.classList.add("active");
    } else {
      challengeHudEl.classList.remove("active");
    }
  }

  if (chTimerEl) chTimerEl.textContent = `${timeLeft}s`;
  if (chLivesEl) chLivesEl.textContent = "❤".repeat(state.lives);
  if (chStreakEl) chStreakEl.textContent = state.streak;
  if (chBestStreakEl) chBestStreakEl.textContent = state.bestStreak;
}

/* =========================
   PERGUNTAS
========================= */

function getClassicQuestion() {
  const index = state.questionIndex % QUIZ.length;
  return QUIZ[index];
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

    if (!response.ok) {
      throw new Error(`Erro do backend (${response.status})`);
    }

    const data = await response.json();

    return {
      question: data.question,
      options: data.options,
      correctIndex: data.correct_index,
      explanation: data.explanation || "",
    };
  } catch (err) {
    console.error("Erro ao buscar pergunta IA:", err);
    alert("Não consegui falar com o backend da IA. Usando pergunta clássica.");
    return getClassicQuestion();
  }
}

/* =========================
   RENDERIZAÇÃO DA PERGUNTA
========================= */

async function renderQuestion() {
  if (!questionEl || !choicesEl) {
    console.warn("[Treino Hero] Elementos de pergunta não encontrados.");
    return;
  }

  // reseta texto
  questionEl.textContent = "";
  choicesEl.innerHTML = "";
  if (explanationEl) explanationEl.textContent = "";

  // escolhe fonte
  if (state.mode === "ia") {
    state.currentQuestion = await getIAQuestion();
  } else {
    state.currentQuestion = getClassicQuestion();
  }

  const q = state.currentQuestion;
  if (!q) {
    questionEl.textContent = "Não há perguntas disponíveis.";
    return;
  }

  questionEl.textContent = q.question;

  q.options.forEach((opt, index) => {
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.className = "choice-btn";
    btn.addEventListener("click", () => handleAnswer(index));
    choicesEl.appendChild(btn);
  });
}

/* =========================
   RESPOSTA DO USUÁRIO
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
      // Aqui você pode disparar o LEVEL UP badge
      // console.log("LEVEL UP!");
    }

    if (state.xp > state.bestXp) {
      state.bestXp = state.xp;
    }

    if (state.streak > state.bestStreak) {
      state.bestStreak = state.streak;
    }
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

  if (explanationEl) {
    explanationEl.textContent = q.explanation || "";
  }

  state.questionIndex += 1;
  saveState();
  updateHUD();

  setTimeout(() => {
    renderQuestion();
  }, 800);
}

/* =========================
   MODOS DE JOGO
========================= */

function setMode(mode) {
  state.mode = mode;
  state.questionIndex = 0;
  state.streak = 0;

  clearInterval(challengeTimer);
  timeLeft = CHALLENGE_DURATION;
  state.lives = CHALLENGE_LIVES_START;

  if (mode === "challenge") {
    startChallenge();
  }

  saveState();
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

    if (timeLeft <= 0) {
      endChallenge();
    }
  }, 1000);
}

function endChallenge() {
  clearInterval(challengeTimer);
  alert("Fim do modo desafio! 💪");
  setMode("classic");
}

/* =========================
   DIFICULDADE E IA
========================= */

function setupDifficulty() {
  if (!diffButtons) return;

  diffButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      diffButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.difficulty = btn.dataset.diff || "medium";
      saveState();
    });
  });
}

function setupIATheme() {
  if (!iaThemeSelect) return;

  iaThemeSelect.value = state.iaTheme;

  iaThemeSelect.addEventListener("change", () => {
    state.iaTheme = iaThemeSelect.value;
    saveState();
  });
}

/* =========================
   RANKING (simples dummy)
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
   EVENTOS DOS BOTÕES
========================= */

function setupModeButtons() {
  if (btnClassic) btnClassic.addEventListener("click", () => setMode("classic"));
  if (btnIA) btnIA.addEventListener("click", () => setMode("ia"));
  if (btnChallenge)
    btnChallenge.addEventListener("click", () => setMode("challenge"));
}

/* =========================
   INICIALIZAÇÃO
========================= */

function initGame() {
  setupDomRefs();
  loadState();
  setupModeButtons();
  setupDifficulty();
  setupIATheme();
  setupRanking();
  updateHUD();
  renderQuestion();
}

// Garante que tudo carregou antes de iniciar
window.onload = () => {
  try {
    initGame();
  } catch (err) {
    console.error("Erro na inicialização do Treino Hero:", err);
  }
};
