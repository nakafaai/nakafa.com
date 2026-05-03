import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{Rp2.500,00}$$", value: false },
    { label: "$$\\text{Rp3.000,00}$$", value: false },
    { label: "$$\\text{Rp4.000,00}$$", value: true },
    { label: "$$\\text{Rp5.000,00}$$", value: false },
    { label: "$$\\text{Rp5.500,00}$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp2.500,00}$$", value: false },
    { label: "$$\\text{Rp3.000,00}$$", value: false },
    { label: "$$\\text{Rp4.000,00}$$", value: true },
    { label: "$$\\text{Rp5.000,00}$$", value: false },
    { label: "$$\\text{Rp5.500,00}$$", value: false },
  ],
};

export default choices;
