import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{Rp }15.000.000,00$$", value: false },
    { label: "$$\\text{Rp }15.600.000,00$$", value: false },
    { label: "$$\\text{Rp }16.000.000,00$$", value: true },
    { label: "$$\\text{Rp }17.200.000,00$$", value: false },
    { label: "$$\\text{Rp }18.600.000,00$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp }15.000.000,00$$", value: false },
    { label: "$$\\text{Rp }15.600.000,00$$", value: false },
    { label: "$$\\text{Rp }16.000.000,00$$", value: true },
    { label: "$$\\text{Rp }17.200.000,00$$", value: false },
    { label: "$$\\text{Rp }18.600.000,00$$", value: false },
  ],
};

export default choices;
