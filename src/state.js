export const state = {
  currentLevel: 1,
  muscleScore: 0,         // 0..10 (define sprite)
  sex: 'masc',            // 'masc' | 'fem'
  correctInLevel: 0,
  wrongInLevel: 0,
  answered: 0,
  load() {
    const s = JSON.parse(localStorage.getItem('treinohero_state') || '{}');
    Object.assign(this, s);
  },
  save() {
    localStorage.setItem('treinohero_state', JSON.stringify({
      currentLevel: this.currentLevel,
      muscleScore: this.muscleScore,
      sex: this.sex
    }));
  },
  resetLevelStats() {
    this.correctInLevel = 0;
    this.wrongInLevel = 0;
    this.answered = 0;
  }
};
