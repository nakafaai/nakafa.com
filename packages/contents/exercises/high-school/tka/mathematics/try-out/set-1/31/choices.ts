import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$-\\frac{1}{10}(6x + 5)(5 - x)^4 + C$$",
      value: false,
    },
    {
      label: "$$-\\frac{1}{10}(4x + 5)(5 - x)^4 + C$$",
      value: true,
    },
    {
      label: "$$-\\frac{1}{10}(x + 5)(5 - x)^4 + C$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{10}(4x + 5)(5 - x)^4 + C$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2}(5 - x)^4 + C$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$-\\frac{1}{10}(6x + 5)(5 - x)^4 + C$$",
      value: false,
    },
    {
      label: "$$-\\frac{1}{10}(4x + 5)(5 - x)^4 + C$$",
      value: true,
    },
    {
      label: "$$-\\frac{1}{10}(x + 5)(5 - x)^4 + C$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{10}(4x + 5)(5 - x)^4 + C$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2}(5 - x)^4 + C$$",
      value: false,
    },
  ],
};

export default choices;
