import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$\\{x \\in R: -4 \\leq x \\leq 4\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\in R: -4 \\leq x \\leq 3\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\in R: x \\leq -4 \\text{ atau } x \\geq 4\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\in R: 0 \\leq x \\leq 3\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\in R: x \\leq -4 \\text{ atau } x \\geq 3\\}$$",
      value: true,
    },
  ],
  en: [
    {
      label: "$$\\{x \\in R: -4 \\leq x \\leq 4\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\in R: -4 \\leq x \\leq 3\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\in R: x \\leq -4 \\text{ or } x \\geq 4\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\in R: 0 \\leq x \\leq 3\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\in R: x \\leq -4 \\text{ or } x \\geq 3\\}$$",
      value: true,
    },
  ],
};

export default choices;
