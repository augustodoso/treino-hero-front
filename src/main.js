import { QUIZ } from "./quiz.js";

/* =========================
   CONFIGURAÇÕES GERAIS
========================= */

// Detecta ambiente
const isLocal =
  location.hostname === "127.0.0.1" || location.hostname === "localhost";

// URL do backend
const API_URL = isLocal
  ? "http://127.0.0.1:8000/generate-question"
  : "https://treino-hero-ia-backend.onrender.com/generate-question";

// Configurações do jogo
const XP_PER_CORRECT = 10;
const XP_PER_LEVEL = 100;
const CHALLENGE_DURATION = 60;
const CHALLENGE_LIVES_START = 3;

/* =========================
   ESTADO GLOBAL
========================= */

let state = {
  mode: "classic",
  level: 1,
  xp: 0,
  energy: 10,
  lives: CHALLENGE_LIVES_START,
  questionIndex: 0,
  currentQuestion: null,
};

let challengeTimer = null;
let timeLeft = CHALLENGE_DURATION;

/* =========================
   ELEMENTOS DOM
========================= */

const questionEl = document.getElementById("question");
const choicesEl = document.getElementById("choices");
const explanationEl = document.getElementById("explanation");

const btnClassic = document.getElementById("mode-classic");
const btnIA = document.getElementById("mode-ia");
const btnChallenge = document.getElementById("mode-challenge");

const hudLevel = document.getElementById("hud-level");
const hudXP = document.getElementById("hud-xp");
const hudEnergy = document.getElementById("hud-energy");
const hudLives = document.getElementById("hud-lives");
const hudTimer = document.getElementById("hud-timer");

/* =========================
   UTILIDADES
========================= */

function saveState() {
  localStorage.setItem("treinoHero", JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem("treinoHero");
  if (saved) state = JSON.parse(saved);
}

function updateHUD() {
  hudLevel.textContent = state.level;
  hudXP.textContent = state.xp;
  hudEnergy.textContent = state.energy;
  if (hudLives) hudLives.textContent = state.lives;
  if (hudTimer) hudTimer.textContent = timeLeft;
}

/* =========================
   PERGUNTAS
========================= */

function getClassicQuestion() {
  return QUIZ[state.questionIndex % QUIZ.length];
}

async function getIAQuestion() {
  try {
    const res = await fetch(API_URL, { method: "POST" });
    if (!res.ok) throw new Error("Erro no backend");

    const data = await res.json();
    return {
      question: data.question,
      options: data.options,
      correctIndex: data.correct_index,
      explanation: data.explanation || "",
    };
  } catch (err) {
    console.error(err);
    alert("Erro ao buscar pergunta IA 😢");
    return getClassicQuestion();
  }
}

/* =========================
   RENDER
========================= */

async function renderQuestion() {
  explanationEl.textContent = "";
  choicesEl.innerHTML = "";

  if (state.mode === "ia") {
    state.currentQuestion = await getIAQuestion();
  } else {
    state.currentQuestion = getClassicQuestion();
  }

  questionEl.textContent = state.currentQuestion.question;

  state.currentQuestion.options.forEach((opt, index) => {
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.className = "choice-btn";
    btn.onclick = () => handleAnswer(index);
    choicesEl.appendChild(btn);
  });
}

function handleAnswer(index) {
  const correct = state.currentQuestion.correctIndex === index;

  if (correct) {
    state.xp += XP_PER_CORRECT;
    if (state.xp >= XP_PER_LEVEL) {
      state.level++;
      state.xp = 0;
    }
  } else if (state.mode === "challenge") {
    state.lives--;
    if (state.lives <= 0) return endChallenge();
  }

  explanationEl.textContent =
    state.currentQuestion.explanation || "";

  state.questionIndex++;
  saveState();
  updateHUD();

  setTimeout(renderQuestion, 1000);
}

/* =========================
   MODOS
========================= */

function setMode(mode) {
  state.mode = mode;
  state.questionIndex = 0;

  clearInterval(challengeTimer);

  if (mode === "challenge") startChallenge();

  saveState();
  updateHUD();
  renderQuestion();
}

function startChallenge() {
  timeLeft = CHALLENGE_DURATION;
  state.lives = CHALLENGE_LIVES_START;

  challengeTimer = setInterval(() => {
    timeLeft--;
    updateHUD();

    if (timeLeft <= 0) endChallenge();
  }, 1000);
}

function endChallenge() {
  clearInterval(challengeTimer);
  alert("Fim do desafio! 💪");
  setMode("classic");
}

/* =========================
   EVENTOS
========================= */

btnClassic.onclick = () => setMode("classic");
btnIA.onclick = () => setMode("ia");
btnChallenge.onclick = () => setMode("challenge");

/* =========================
   INIT
========================= */

loadState();
updateHUD();
renderQuestion();
