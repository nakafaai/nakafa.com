import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{Rp}120.000,00$$", value: false },
    { label: "$$\\text{Rp}180.000,00$$", value: false },
    { label: "$$\\text{Rp}360.000,00$$", value: true },
    { label: "$$\\text{Rp}380.000,00$$", value: false },
    { label: "$$\\text{Rp}420.000,00$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp}120,000.00$$", value: false },
    { label: "$$\\text{Rp}180,000.00$$", value: false },
    { label: "$$\\text{Rp}360,000.00$$", value: true },
    { label: "$$\\text{Rp}380,000.00$$", value: false },
    { label: "$$\\text{Rp}420,000.00$$", value: false },
  ],
};

export default choices;
