import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\frac{5!}{2}$$", value: false },
    { label: "$$5!$$", value: false },
    { label: "$$2(5!)$$", value: true },
    { label: "$$2(6!)$$", value: false },
    { label: "$$\\frac{7!}{2}$$", value: false },
  ],
  en: [
    { label: "$$\\frac{5!}{2}$$", value: false },
    { label: "$$5!$$", value: false },
    { label: "$$2(5!)$$", value: true },
    { label: "$$2(6!)$$", value: false },
    { label: "$$\\frac{7!}{2}$$", value: false },
  ],
};

export default choices;
