export function getPlan(goal="hipertrofia", days=3){
  const base = {
    hipertrofia: [
      "A: Supino, Remada, Agachamento, Desenvolvimento, Core",
      "B: Terra romeno, Puxada, Avanço, Rosca, Tríceps",
      "C: Paralelas, Remo unilateral, Levantar terra leve, Elevação lateral, Core"
    ],
    condicionamento: [
      "A: Circuito 20' (Kettlebell swing, Flexão, Remo TRX, Agachamento)",
      "B: EMOM 16' (Burpee, Remada, Agachamento, Prancha)",
      "C: Intervalado 10x(30\" on/30\" off) + Core"
    ],
    mobilidade: [
      "A: Cadeia posterior 20' + estabilização quadril",
      "B: Torácica/ombro 20' + escápulas",
      "C: Tornozelo/quadril 20' + respiração"
    ]
  };
  return base[goal].slice(0, Math.min(days, base[goal].length));
}
