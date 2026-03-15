import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$\\frac{1}{2}$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2}\\sqrt{2}$$",
      value: false,
    },
    {
      label: "$$\\sqrt{2}$$",
      value: false,
    },
    {
      label: "$$\\sqrt{3}$$",
      value: true,
    },
    {
      label: "$$\\sqrt{6}$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\frac{1}{2}$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2}\\sqrt{2}$$",
      value: false,
    },
    {
      label: "$$\\sqrt{2}$$",
      value: false,
    },
    {
      label: "$$\\sqrt{3}$$",
      value: true,
    },
    {
      label: "$$\\sqrt{6}$$",
      value: false,
    },
  ],
};

export default choices;
