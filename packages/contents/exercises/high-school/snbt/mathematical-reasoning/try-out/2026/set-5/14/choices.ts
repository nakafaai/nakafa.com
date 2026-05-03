import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{Rp}10.500,00}$$", value: false },
    { label: "$$\\text{Rp}10.000,00}$$", value: false },
    { label: "$$\\text{Rp}9.500,00}$$", value: true },
    { label: "$$\\text{Rp}9.000,00}$$", value: false },
    { label: "$$\\text{Rp}8.500,00}$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp}10,500.00}$$", value: false },
    { label: "$$\\text{Rp}10,000.00}$$", value: false },
    { label: "$$\\text{Rp}9,500.00}$$", value: true },
    { label: "$$\\text{Rp}9,000.00}$$", value: false },
    { label: "$$\\text{Rp}8,500.00}$$", value: false },
  ],
};

export default choices;
