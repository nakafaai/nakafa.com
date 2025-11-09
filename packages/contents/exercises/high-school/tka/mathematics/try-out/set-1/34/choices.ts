import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$\\frac{-1}{(3x^2 - 2x + 7)^6} + C$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{12(3x^2 - 2x + 7)^6} + C$$",
      value: false,
    },
    {
      label: "$$\\frac{-1}{12(3x^2 - 2x + 7)^6} + C$$",
      value: true,
    },
    {
      label: "$$\\frac{-1}{6(3x^2 - 2x + 7)^6} + C$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{6(3x^2 - 2x + 7)^6} + C$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\frac{-1}{(3x^2 - 2x + 7)^6} + C$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{12(3x^2 - 2x + 7)^6} + C$$",
      value: false,
    },
    {
      label: "$$\\frac{-1}{12(3x^2 - 2x + 7)^6} + C$$",
      value: true,
    },
    {
      label: "$$\\frac{-1}{6(3x^2 - 2x + 7)^6} + C$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{6(3x^2 - 2x + 7)^6} + C$$",
      value: false,
    },
  ],
};

export default choices;
