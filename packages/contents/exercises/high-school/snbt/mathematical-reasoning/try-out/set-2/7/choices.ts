import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{Rp}24.750.000,00$$", value: false },
    { label: "$$\\text{Rp}25.000.000,00$$", value: false },
    { label: "$$\\text{Rp}26.250.000,00$$", value: true },
    { label: "$$\\text{Rp}28.000.000,00$$", value: false },
    { label: "$$\\text{Rp}32.750.000,00$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp}24,750,000.00$$", value: false },
    { label: "$$\\text{Rp}25,000,000.00$$", value: false },
    { label: "$$\\text{Rp}26,250,000.00$$", value: true },
    { label: "$$\\text{Rp}28,000,000.00$$", value: false },
    { label: "$$\\text{Rp}32,750,000.00$$", value: false },
  ],
};

export default choices;
