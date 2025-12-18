export function renderHUD(state) {
  const el = document.querySelector("[data-hud]");
  el.innerHTML = `
    <div class="stat">Nível <b>${state.nivel}</b></div>
    <div class="stat">Força <b>${state.forca}</b></div>
    <div class="stat">Energia <b>${state.energia}</b></div>
    <div class="stat">XP <b>${state.xp}</b></div>
    <div class="stat">Moedas <b>${state.moedas}</b></div>
  `;
}

export function renderQuestion(q, onAnswer) {
  const el = document.querySelector("[data-card]");
  el.innerHTML = `
    <h2>${q.q}</h2>
    <div class="options">
      ${q.options.map((o,i)=>`<button data-opt="${i}">${o}</button>`).join("")}
    </div>
  `;
  el.querySelectorAll("[data-opt]").forEach(btn => {
    btn.addEventListener("click", () => onAnswer(parseInt(btn.dataset.opt)));
  });
}
