import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{Rp}250.000,00$$", value: true },
    { label: "$$\\text{Rp}275.000,00$$", value: false },
    { label: "$$\\text{Rp}425.000,00$$", value: false },
    { label: "$$\\text{Rp}460.000,00$$", value: false },
    { label: "$$\\text{Rp}500.000,00$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp}250,000.00$$", value: true },
    { label: "$$\\text{Rp}275,000.00$$", value: false },
    { label: "$$\\text{Rp}425,000.00$$", value: false },
    { label: "$$\\text{Rp}460,000.00$$", value: false },
    { label: "$$\\text{Rp}500,000.00$$", value: false },
  ],
};

export default choices;
