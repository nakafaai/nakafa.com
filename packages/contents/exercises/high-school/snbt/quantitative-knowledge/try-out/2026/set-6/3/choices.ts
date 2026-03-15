import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\frac{1}{2}$$", value: false },
    { label: "$$\\frac{1}{7}$$", value: false },
    { label: "$$\\frac{1}{4}$$", value: false },
    { label: "$$\\frac{3}{7}$$", value: true },
    { label: "$$\\frac{8}{9}$$", value: false },
  ],
  en: [
    { label: "$$\\frac{1}{2}$$", value: false },
    { label: "$$\\frac{1}{7}$$", value: false },
    { label: "$$\\frac{1}{4}$$", value: false },
    { label: "$$\\frac{3}{7}$$", value: true },
    { label: "$$\\frac{8}{9}$$", value: false },
  ],
};

export default choices;
