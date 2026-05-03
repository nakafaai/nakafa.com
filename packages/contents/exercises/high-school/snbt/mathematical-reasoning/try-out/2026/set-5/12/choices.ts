import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{Rp}12.000,00}$$", value: false },
    { label: "$$\\text{Rp}12.100,00}$$", value: false },
    { label: "$$\\text{Rp}12.200,00}$$", value: false },
    { label: "$$\\text{Rp}12.320,00}$$", value: true },
    { label: "$$\\text{Rp}12.500,00}$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp}12,000.00}$$", value: false },
    { label: "$$\\text{Rp}12,100.00}$$", value: false },
    { label: "$$\\text{Rp}12,200.00}$$", value: false },
    { label: "$$\\text{Rp}12,320.00}$$", value: true },
    { label: "$$\\text{Rp}12,500.00}$$", value: false },
  ],
};

export default choices;
