import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$\\frac{-f(-1)}{2}(1 + x)$$",
      value: false,
    },
    {
      label: "$$\\frac{-f(-1)}{2}(1 - x)$$",
      value: false,
    },
    {
      label: "$$\\frac{f(-1)}{2}(1 + x)$$",
      value: false,
    },
    {
      label: "$$\\frac{f(-1)}{2}(1 - x)$$",
      value: true,
    },
    {
      label: "$$\\frac{f(-1)}{2}(x - 1)$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\frac{-f(-1)}{2}(1 + x)$$",
      value: false,
    },
    {
      label: "$$\\frac{-f(-1)}{2}(1 - x)$$",
      value: false,
    },
    {
      label: "$$\\frac{f(-1)}{2}(1 + x)$$",
      value: false,
    },
    {
      label: "$$\\frac{f(-1)}{2}(1 - x)$$",
      value: true,
    },
    {
      label: "$$\\frac{f(-1)}{2}(x - 1)$$",
      value: false,
    },
  ],
};

export default choices;
