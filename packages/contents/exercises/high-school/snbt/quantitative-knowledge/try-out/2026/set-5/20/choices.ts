import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\frac{2x + 12}{x^2 - 4}$$", value: false },
    { label: "$$\\frac{x - 12}{x^2 - 4}$$", value: false },
    { label: "$$\\frac{-x + 12}{x^2 - 4}$$", value: false },
    { label: "$$\\frac{-2x}{x^2 - 4}$$", value: false },
    { label: "$$\\frac{x - 4}{x^2 - 4}$$", value: true },
  ],
  en: [
    { label: "$$\\frac{2x + 12}{x^2 - 4}$$", value: false },
    { label: "$$\\frac{x - 12}{x^2 - 4}$$", value: false },
    { label: "$$\\frac{-x + 12}{x^2 - 4}$$", value: false },
    { label: "$$\\frac{-2x}{x^2 - 4}$$", value: false },
    { label: "$$\\frac{x - 4}{x^2 - 4}$$", value: true },
  ],
};

export default choices;
