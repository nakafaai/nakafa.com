import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$\\frac{x + y}{12}$$",
      value: false,
    },
    {
      label: "$$\\frac{2x + y}{12}$$",
      value: false,
    },
    {
      label: "$$\\frac{3x + y}{12}$$",
      value: false,
    },
    {
      label: "$$\\frac{4x + y}{12}$$",
      value: true,
    },
    {
      label: "$$\\frac{5x + y}{12}$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\frac{x + y}{12}$$",
      value: false,
    },
    {
      label: "$$\\frac{2x + y}{12}$$",
      value: false,
    },
    {
      label: "$$\\frac{3x + y}{12}$$",
      value: false,
    },
    {
      label: "$$\\frac{4x + y}{12}$$",
      value: true,
    },
    {
      label: "$$\\frac{5x + y}{12}$$",
      value: false,
    },
  ],
};

export default choices;
