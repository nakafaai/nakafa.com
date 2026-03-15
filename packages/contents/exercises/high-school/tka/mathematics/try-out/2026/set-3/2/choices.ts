import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$b < -\\frac{1}{2}$$",
      value: false,
    },
    {
      label: "$$-\\frac{1}{2} < b < 0$$",
      value: false,
    },
    {
      label: "$$b > -\\frac{1}{2}$$",
      value: true,
    },
    {
      label: "$$0 < b < \\frac{1}{2}$$",
      value: false,
    },
    {
      label: "$$b > 0$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$b < -\\frac{1}{2}$$",
      value: false,
    },
    {
      label: "$$-\\frac{1}{2} < b < 0$$",
      value: false,
    },
    {
      label: "$$b > -\\frac{1}{2}$$",
      value: true,
    },
    {
      label: "$$0 < b < \\frac{1}{2}$$",
      value: false,
    },
    {
      label: "$$b > 0$$",
      value: false,
    },
  ],
};

export default choices;
