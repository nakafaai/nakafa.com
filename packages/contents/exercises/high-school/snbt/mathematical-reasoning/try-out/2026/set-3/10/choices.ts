import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\frac{1}{72}$$", value: false },
    { label: "$$\\frac{1}{27}$$", value: false },
    { label: "$$\\frac{1}{16}$$", value: false },
    { label: "$$\\frac{1}{12}$$", value: false },
    { label: "$$\\frac{1}{6}$$", value: true },
  ],
  en: [
    { label: "$$\\frac{1}{72}$$", value: false },
    { label: "$$\\frac{1}{27}$$", value: false },
    { label: "$$\\frac{1}{16}$$", value: false },
    { label: "$$\\frac{1}{12}$$", value: false },
    { label: "$$\\frac{1}{6}$$", value: true },
  ],
};

export default choices;
