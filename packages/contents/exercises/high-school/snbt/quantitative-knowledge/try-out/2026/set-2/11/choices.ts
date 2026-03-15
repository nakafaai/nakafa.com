import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

// Date: 11/22/2025
const choices: ExercisesChoices = {
  id: [
    {
      label: "$$x \\in [2, 5) \\cup [5, 8)$$",
      value: false,
    },
    {
      label: "$$x \\in [0, 2) \\cup [5, 10)$$",
      value: false,
    },
    {
      label: "$$x \\in [2, 8)$$",
      value: false,
    },
    {
      label: "$$x \\in [5, 10)$$",
      value: false,
    },
    {
      label: "$$x \\in [2, 10)$$",
      value: true,
    },
  ],
  en: [
    {
      label: "$$x \\in [2, 5) \\cup [5, 8)$$",
      value: false,
    },
    {
      label: "$$x \\in [0, 2) \\cup [5, 10)$$",
      value: false,
    },
    {
      label: "$$x \\in [2, 8)$$",
      value: false,
    },
    {
      label: "$$x \\in [5, 10)$$",
      value: false,
    },
    {
      label: "$$x \\in [2, 10)$$",
      value: true,
    },
  ],
};

export default choices;
