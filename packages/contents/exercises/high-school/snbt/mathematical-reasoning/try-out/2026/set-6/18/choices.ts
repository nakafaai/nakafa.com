import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\frac{1}{3}\\sqrt{6}$$", value: true },
    { label: "$$\\frac{1}{3}\\sqrt{2}$$", value: false },
    { label: "$$\\frac{1}{3}\\sqrt{3}$$", value: false },
    { label: "$$\\frac{1}{2}\\sqrt{2}$$", value: false },
    { label: "$$\\frac{1}{2}\\sqrt{3}$$", value: false },
  ],
  en: [
    { label: "$$\\frac{1}{3}\\sqrt{6}$$", value: true },
    { label: "$$\\frac{1}{3}\\sqrt{2}$$", value: false },
    { label: "$$\\frac{1}{3}\\sqrt{3}$$", value: false },
    { label: "$$\\frac{1}{2}\\sqrt{2}$$", value: false },
    { label: "$$\\frac{1}{2}\\sqrt{3}$$", value: false },
  ],
};

export default choices;
