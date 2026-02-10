import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{Rp }27.500,00$$", value: false },
    { label: "$$\\text{Rp }32.500,00$$", value: false },
    { label: "$$\\text{Rp }35.000,00$$", value: false },
    { label: "$$\\text{Rp }37.500,00$$", value: true },
    { label: "$$\\text{Rp }42.500,00$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp }27,500.00$$", value: false },
    { label: "$$\\text{Rp }32,500.00$$", value: false },
    { label: "$$\\text{Rp }35,000.00$$", value: false },
    { label: "$$\\text{Rp }37,500.00$$", value: true },
    { label: "$$\\text{Rp }42,500.00$$", value: false },
  ],
};

export default choices;
