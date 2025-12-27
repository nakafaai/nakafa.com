import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\frac{1}{3}$$", value: false },
    { label: "$$\\frac{32}{99}$$", value: false },
    { label: "$$\\frac{23}{99}$$", value: false },
    { label: "$$\\frac{232}{999}$$", value: false },
    { label: "$$\\frac{323}{999}$$", value: true },
  ],
  en: [
    { label: "$$\\frac{1}{3}$$", value: false },
    { label: "$$\\frac{32}{99}$$", value: false },
    { label: "$$\\frac{23}{99}$$", value: false },
    { label: "$$\\frac{232}{999}$$", value: false },
    { label: "$$\\frac{323}{999}$$", value: true },
  ],
};

export default choices;
