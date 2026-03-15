import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\frac{8}{3}$$", value: false },
    { label: "$$-\\frac{8}{3}$$", value: false },
    { label: "$$\\frac{17}{6}$$", value: false },
    { label: "$$-\\frac{17}{6}$$", value: true },
    { label: "$$\\frac{19}{9}$$", value: false },
  ],
  en: [
    { label: "$$\\frac{8}{3}$$", value: false },
    { label: "$$-\\frac{8}{3}$$", value: false },
    { label: "$$\\frac{17}{6}$$", value: false },
    { label: "$$-\\frac{17}{6}$$", value: true },
    { label: "$$\\frac{19}{9}$$", value: false },
  ],
};

export default choices;
