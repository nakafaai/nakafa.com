import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{Rp}60.000,00$$", value: false },
    { label: "$$\\text{Rp}65.000,00$$", value: false },
    { label: "$$\\text{Rp}67.000,00$$", value: false },
    { label: "$$\\text{Rp}70.000,00$$", value: true },
    { label: "$$\\text{Rp}75.000,00$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp}60,000.00$$", value: false },
    { label: "$$\\text{Rp}65,000.00$$", value: false },
    { label: "$$\\text{Rp}67,000.00$$", value: false },
    { label: "$$\\text{Rp}70,000.00$$", value: true },
    { label: "$$\\text{Rp}75,000.00$$", value: false },
  ],
};

export default choices;
