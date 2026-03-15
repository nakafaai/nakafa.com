import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{Rp}3.800.000,00$$", value: false },
    { label: "$$\\text{Rp}4.200.000,00$$", value: false },
    { label: "$$\\text{Rp}4.800.000,00$$", value: true },
    { label: "$$\\text{Rp}5.000.000,00$$", value: false },
    { label: "$$\\text{Rp}5.200.000,00$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp}3,800,000.00$$", value: false },
    { label: "$$\\text{Rp}4,200,000.00$$", value: false },
    { label: "$$\\text{Rp}4,800,000.00$$", value: true },
    { label: "$$\\text{Rp}5,000,000.00$$", value: false },
    { label: "$$\\text{Rp}5,200,000.00$$", value: false },
  ],
};

export default choices;
