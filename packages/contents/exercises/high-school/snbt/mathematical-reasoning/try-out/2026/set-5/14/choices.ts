import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{Rp10.500,00}$$", value: false },
    { label: "$$\\text{Rp10.000,00}$$", value: false },
    { label: "$$\\text{Rp9.500,00}$$", value: true },
    { label: "$$\\text{Rp9.000,00}$$", value: false },
    { label: "$$\\text{Rp8.500,00}$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp10,500.00}$$", value: false },
    { label: "$$\\text{Rp10,000.00}$$", value: false },
    { label: "$$\\text{Rp9,500.00}$$", value: true },
    { label: "$$\\text{Rp9,000.00}$$", value: false },
    { label: "$$\\text{Rp8,500.00}$$", value: false },
  ],
};

export default choices;
