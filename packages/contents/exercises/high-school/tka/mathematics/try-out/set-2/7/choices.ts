import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$\\frac{1}{2^{11}} + \\frac{1}{2^{12}}$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2^{11}} + \\frac{1}{2^{22}}$$",
      value: true,
    },
    {
      label: "$$\\frac{1}{2^{11}}$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2^{22}}$$",
      value: false,
    },
    {
      label: "$$\\frac{3}{2^{12}}$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\frac{1}{2^{11}} + \\frac{1}{2^{12}}$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2^{11}} + \\frac{1}{2^{22}}$$",
      value: true,
    },
    {
      label: "$$\\frac{1}{2^{11}}$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2^{22}}$$",
      value: false,
    },
    {
      label: "$$\\frac{3}{2^{12}}$$",
      value: false,
    },
  ],
};

export default choices;
