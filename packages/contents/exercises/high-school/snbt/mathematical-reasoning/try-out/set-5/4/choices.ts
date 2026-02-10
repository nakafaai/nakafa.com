import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{Rp }4.275.000,00$$", value: false },
    { label: "$$\\text{Rp }427.500,00$$", value: false },
    { label: "$$\\text{Rp }4.702.500,00$$", value: true },
    { label: "$$\\text{Rp }5.250.000,00$$", value: false },
    { label: "$$\\text{Rp }400.000,00$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp }4,275,000.00$$", value: false },
    { label: "$$\\text{Rp }427,500.00$$", value: false },
    { label: "$$\\text{Rp }4,702,500.00$$", value: true },
    { label: "$$\\text{Rp }5,250,000.00$$", value: false },
    { label: "$$\\text{Rp }400,000.00$$", value: false },
  ],
};

export default choices;
