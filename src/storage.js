const KEY = "treino-hero-save";
export const save = (state) => localStorage.setItem(KEY, JSON.stringify(state));
export const load = (fallback) => {
  try { return JSON.parse(localStorage.getItem(KEY)) || fallback(); }
  catch { return fallback(); }
};
export const reset = () => localStorage.removeItem(KEY);
