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
  mode: "classic",         // classic | ia | challenge
  level: 1,
  xp: 0,
  energy: 10,
  lives: CHALLENGE_LIVES_START,
  questionIndex: 0,
  currentQuestion: null,
};

let state = { ...initialState };

let challengeTimer = null;
let timeLeft = CHALLENGE_DURATION;

/* =========================
   REFERÊNCIAS DO DOM
   (preenchidas só depois do DOM pronto)
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

/**
 * Busca os elementos do DOM depois do carregamento.
 * Se algum não existir, só registra erro no console (não quebra o jogo).
 */
function setupDomRefs() {
  questionEl = document.getElementById("question");
  choicesEl = document.getElementById("choices");
  explanationEl = document.getElementById("explanation");

  btnClassic = document.getElementById("mode-classic");
  btnIA = document.getElementById("mode-ia");
  btnChallenge = document.getElementById("mode-challenge");

  hudLevel = document.getElementById("hud-level");
  hudXP = document.getElementById("hud-xp");
  hudEnergy = document.getElementById("hud-energy");
  hudLives = document.getElementById("hud-lives");
  hudTimer = document.getElementById("hud-timer");

  // Debug leve: se algo importante não existir, avisa
  if (!questionEl || !choicesEl) {
    console.warn(
      "[Treino Hero] Elementos principais não encontrados (question / choices). " +
        "Confere se os IDs existem no index.html."
    );
  }
}

/* =========================
   PERSISTÊNCIA (LOCALSTORAGE)
========================= */

function saveState() {
  try {
    localStorage.setItem("treinoHero", JSON.stringify(state));
  } catch (err) {
    console.warn("Não foi possível salvar o estado:", err);
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem("treinoHero");
    if (saved) {
      const parsed = JSON.parse(saved);

      // Faz um merge seguro com o estado inicial
      state = { ...initialState, ...parsed };
    }
  } catch (err) {
    console.warn("Não foi possível carregar o estado salvo:", err);
    state = { ...initialState };
  }
}

/* =========================
   HUD (LEVEL / XP / ENERGIA / VIDAS / TEMPO)
========================= */

function updateHUD() {
  // Cada campo só é atualizado se o elemento existir,
  // assim não quebra se algum ID estiver diferente no HTML.

  if (hudLevel) {
    hudLevel.textContent = state.level;
  }

  if (hudXP) {
    hudXP.textContent = `${state.xp} / ${XP_PER_LEVEL}`;
  }

  if (hudEnergy) {
    hudEnergy.textContent = state.energy;
  }

  if (hudLives) {
    hudLives.textContent = state.lives;
  }

  if (hudTimer) {
    hudTimer.textContent =
      state.mode === "challenge" ? `${timeLeft}s` : "--";
  }
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
      body: JSON.stringify({ topic: "fisiologia", difficulty: "medium" }),
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
    console.warn(
      "[Treino Hero] Não há elementos de pergunta/opções no DOM."
    );
    return;
  }

  explanationEl && (explanationEl.textContent = "");
  choicesEl.innerHTML = "";

  // Escolhe fonte de pergunta
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
    state.xp += XP_PER_CORRECT;
    if (state.xp >= XP_PER_LEVEL) {
      state.level += 1;
      state.xp = 0;
    }
  } else if (state.mode === "challenge") {
    state.lives -= 1;
    if (state.lives <= 0) {
      endChallenge();
      return;
    }
  }

  if (explanationEl) {
    explanationEl.textContent = q.explanation || "";
  }

  state.questionIndex += 1;
  saveState();
  updateHUD();

  // Próxima pergunta depois de 1s
  setTimeout(() => {
    renderQuestion();
  }, 1000);
}

/* =========================
   MODOS DE JOGO
========================= */

function setMode(mode) {
  state.mode = mode;
  state.questionIndex = 0;

  // Reseta desafio se sair / entrar
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
    if (timeLeft < 0) {
      timeLeft = 0;
    }

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
   EVENTOS DOS BOTÕES
========================= */

function setupEvents() {
  if (btnClassic) {
    btnClassic.addEventListener("click", () => setMode("classic"));
  }

  if (btnIA) {
    btnIA.addEventListener("click", () => setMode("ia"));
  }

  if (btnChallenge) {
    btnChallenge.addEventListener("click", () => setMode("challenge"));
  }
}

/* =========================
   INICIALIZAÇÃO
========================= */

function initGame() {
  setupDomRefs();  // pega os elementos DEPOIS do DOM pronto
  loadState();
  updateHUD();
  setupEvents();
  renderQuestion();
}

// Garante que tudo só rode depois do DOM pronto
window.addEventListener("DOMContentLoaded", () => {
  try {
    initGame();
  } catch (err) {
    console.error("Erro na inicialização do Treino Hero:", err);
  }
});
