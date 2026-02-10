import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{Rp}2.400.000,00$$", value: false },
    { label: "$$\\text{Rp}3.000.000,00$$", value: false },
    { label: "$$\\text{Rp}3.600.000,00$$", value: false },
    { label: "$$\\text{Rp}6.000.000,00$$", value: false },
    { label: "$$\\text{Rp}9.000.000,00$$", value: true },
  ],
  en: [
    { label: "$$\\text{Rp}2,400,000.00$$", value: false },
    { label: "$$\\text{Rp}3,000,000.00$$", value: false },
    { label: "$$\\text{Rp}3,600,000.00$$", value: false },
    { label: "$$\\text{Rp}6,000,000.00$$", value: false },
    { label: "$$\\text{Rp}9,000,000.00$$", value: true },
  ],
};

export default choices;
