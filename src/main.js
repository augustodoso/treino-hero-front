// src/main.js
import { QUIZ } from "./quiz.js";

/* =========================
   CONFIGURAÇÕES GERAIS
========================= */

// Detecta ambiente (local x deploy)
const isLocal =
  location.hostname === "127.0.0.1" || location.hostname === "localhost";

// URL do backend (IA)
const API_URL = isLocal
  ? "http://127.0.0.1:8000/generate-question"
  : "https://treino-hero-ia-backend.onrender.com/generate-question";

// Configurações de XP / Level / Desafio
const XP_PER_CORRECT = 10;
const XP_PER_LEVEL = 100;
const CHALLENGE_DURATION = 60; // segundos
const CHALLENGE_LIVES_START = 3;

// Storage
const STORAGE_KEY = "treinoHero_stats";

/* =========================
   ESTADO GLOBAL
========================= */

const DEFAULT_STATE = {
  mode: "classic",      // classic | ia | challenge
  level: 1,
  xp: 0,
  energy: 10,
  lives: CHALLENGE_LIVES_START,
  questionIndex: 0,
  currentQuestion: null,
  streak: 0,
  bestStreak: 0,
};

let state = { ...DEFAULT_STATE };
let timeLeft = CHALLENGE_DURATION;
let challengeTimer = null;

/* =========================
   REFERÊNCIAS DE DOM
   (serão preenchidas no init)
========================= */

let questionEl;
let choicesEl;
let explanationEl;

let btnClassic;
let btnIA;
let btnChallenge;

let hudLevel;
let hudXP;
let hudEnergy;
let hudLives;
let hudTimer;

/* =========================
   STORAGE
========================= */

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Não foi possível salvar no localStorage:", err);
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    // Faz merge para garantir que nada fique undefined
    state = { ...DEFAULT_STATE, ...parsed };
  } catch (err) {
    console.warn("Não foi possível carregar estado salvo:", err);
    state = { ...DEFAULT_STATE };
  }
}

/* =========================
   HUD
========================= */

function updateHUD() {
  try {
    if (hudLevel) hudLevel.textContent = state.level;
    if (hudXP) hudXP.textContent = state.xp;
    if (hudEnergy) hudEnergy.textContent = state.energy;
    if (hudLives) hudLives.textContent = state.lives;
    if (hudTimer) hudTimer.textContent = timeLeft;
  } catch (err) {
    console.error("Erro ao atualizar HUD:", err);
  }
}

/* =========================
   PERGUNTAS
========================= */

function getClassicQuestion() {
  // garante que sempre caia dentro do array
  const index = state.questionIndex % QUIZ.length;
  return QUIZ[index];
}

async function getIAQuestion() {
  try {
    const res = await fetch(API_URL, { method: "POST" });

    if (!res.ok) {
      throw new Error("Erro ao chamar backend IA");
    }

    const data = await res.json();

    return {
      question: data.question,
      options: data.options,
      correctIndex: data.correct_index,
      explanation: data.explanation || "",
    };
  } catch (err) {
    console.error("Erro ao buscar pergunta IA, caindo para pergunta local:", err);
    // fallback para pergunta local pra não quebrar o jogo
    return getClassicQuestion();
  }
}

/* =========================
   RENDERIZAÇÃO DA PERGUNTA
========================= */

async function renderQuestion() {
  try {
    if (!questionEl || !choicesEl || !explanationEl) {
      console.warn("Elementos de pergunta não encontrados no DOM.");
      return;
    }

    explanationEl.textContent = "";
    choicesEl.innerHTML = "";

    if (state.mode === "ia") {
      state.currentQuestion = await getIAQuestion();
    } else {
      state.currentQuestion = getClassicQuestion();
    }

    if (!state.currentQuestion) {
      console.warn("Nenhuma pergunta disponível.");
      return;
    }

    questionEl.textContent = state.currentQuestion.question || "Pergunta indisponível";

    state.currentQuestion.options.forEach((opt, index) => {
      const btn = document.createElement("button");
      btn.textContent = opt;
      btn.className = "choice-btn";
      btn.addEventListener("click", () => handleAnswer(index));
      choicesEl.appendChild(btn);
    });
  } catch (err) {
    console.error("Erro ao renderizar pergunta:", err);
  }
}

/* =========================
   RESPOSTA DO USUÁRIO
========================= */

function handleAnswer(index) {
  try {
    if (!state.currentQuestion) return;

    const correct = state.currentQuestion.correctIndex === index;

    if (correct) {
      state.xp += XP_PER_CORRECT;
      state.streak += 1;
      if (state.streak > state.bestStreak) {
        state.bestStreak = state.streak;
      }

      if (state.xp >= XP_PER_LEVEL) {
        state.level += 1;
        state.xp = 0;
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
      explanationEl.textContent =
        state.currentQuestion.explanation || "";
    }

    state.questionIndex += 1;
    saveState();
    updateHUD();

    // pequena pausa para o jogador ver o feedback
    setTimeout(() => {
      renderQuestion();
    }, 800);
  } catch (err) {
    console.error("Erro ao processar resposta:", err);
  }
}

/* =========================
   MODOS DE JOGO
========================= */

function setMode(mode) {
  try {
    state.mode = mode;
    state.questionIndex = 0;
    state.streak = 0;

    if (challengeTimer) {
      clearInterval(challengeTimer);
      challengeTimer = null;
    }

    if (mode === "challenge") {
      startChallenge();
    } else {
      // reset de coisas específicas do desafio
      timeLeft = CHALLENGE_DURATION;
      state.lives = CHALLENGE_LIVES_START;
    }

    saveState();
    updateHUD();
    renderQuestion();
  } catch (err) {
    console.error("Erro ao mudar modo:", err);
  }
}

function startChallenge() {
  timeLeft = CHALLENGE_DURATION;
  state.lives = CHALLENGE_LIVES_START;

  updateHUD();

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
  if (challengeTimer) {
    clearInterval(challengeTimer);
    challengeTimer = null;
  }
  alert("Fim do desafio! 💪");
  setMode("classic");
}

/* =========================
   INICIALIZAÇÃO (DOM READY)
========================= */

function initGame() {
  // Elementos de pergunta
  questionEl = document.getElementById("question");
  choicesEl = document.getElementById("choices");
  explanationEl = document.getElementById("explanation");

  if (!questionEl || !choicesEl || !explanationEl) {
    console.warn(
      "Alguns elementos do quiz (#question, #choices, #explanation) não foram encontrados. Verifique os IDs no index.html."
    );
  }

  // Botões de modo
  btnClassic = document.getElementById("mode-classic");
  btnIA = document.getElementById("mode-ia");
  btnChallenge = document.getElementById("mode-challenge");

  if (btnClassic) {
    btnClassic.addEventListener("click", () => setMode("classic"));
  } else {
    console.warn("Botão #mode-classic não encontrado.");
  }

  if (btnIA) {
    btnIA.addEventListener("click", () => setMode("ia"));
  } else {
    console.warn("Botão #mode-ia não encontrado.");
  }

  if (btnChallenge) {
    btnChallenge.addEventListener("click", () => setMode("challenge"));
  } else {
    console.warn("Botão #mode-challenge não encontrado.");
  }

  // HUD – tenta vários IDs, mas sempre protege com if
  hudLevel =
    document.getElementById("hud-level") ||
    document.getElementById("level-value") ||
    document.getElementById("level");

  hudXP =
    document.getElementById("hud-xp") ||
    document.getElementById("xp-value") ||
    document.getElementById("xp");

  hudEnergy =
    document.getElementById("hud-energy") ||
    document.getElementById("energy-value") ||
    document.getElementById("energy");

  hudLives =
    document.getElementById("hud-lives") ||
    document.getElementById("lives-value") ||
    document.getElementById("lives");

  hudTimer =
    document.getElementById("hud-timer") ||
    document.getElementById("timer-value") ||
    document.getElementById("timer");

  loadState();
  updateHUD();
  renderQuestion();
}

// Só roda depois do DOM estar pronto
window.addEventListener("DOMContentLoaded", () => {
  try {
    initGame();
  } catch (err) {
    console.error("Erro na inicialização do jogo:", err);
  }
});
