import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{Rp}16.000,00$$", value: false },
    { label: "$$\\text{Rp}18.000,00$$", value: false },
    { label: "$$\\text{Rp}20.000,00$$", value: true },
    { label: "$$\\text{Rp}25.000,00$$", value: false },
    { label: "$$\\text{Rp}32.000,00$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp}16,000.00$$", value: false },
    { label: "$$\\text{Rp}18,000.00$$", value: false },
    { label: "$$\\text{Rp}20,000.00$$", value: true },
    { label: "$$\\text{Rp}25,000.00$$", value: false },
    { label: "$$\\text{Rp}32,000.00$$", value: false },
  ],
};

export default choices;
