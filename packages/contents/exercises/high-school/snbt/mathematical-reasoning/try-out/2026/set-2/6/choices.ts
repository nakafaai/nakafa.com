import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$3\\sqrt{2}$$", value: true },
    { label: "$$2\\sqrt{2}$$", value: false },
    { label: "$$\\sqrt{2}$$", value: false },
    { label: "$$\\frac{1}{2}\\sqrt{2}$$", value: false },
    { label: "$$\\frac{1}{3}\\sqrt{2}$$", value: false },
  ],
  en: [
    { label: "$$3\\sqrt{2}$$", value: true },
    { label: "$$2\\sqrt{2}$$", value: false },
    { label: "$$\\sqrt{2}$$", value: false },
    { label: "$$\\frac{1}{2}\\sqrt{2}$$", value: false },
    { label: "$$\\frac{1}{3}\\sqrt{2}$$", value: false },
  ],
};

export default choices;
