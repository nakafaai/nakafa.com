import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$\\left\\{0, \\frac{1}{2}\\pi, \\pi\\right\\}$$",
      value: false,
    },
    {
      label: "$$\\left\\{0, \\frac{1}{2}\\pi, \\frac{2}{3}\\pi\\right\\}$$",
      value: false,
    },
    {
      label:
        "$$\\left\\{0, \\frac{1}{2}\\pi, \\pi, \\frac{3}{2}\\pi\\right\\}$$",
      value: false,
    },
    {
      label:
        "$$\\left\\{0, \\frac{1}{2}\\pi, \\frac{2}{3}\\pi, 2\\pi\\right\\}$$",
      value: false,
    },
    {
      label:
        "$$\\left\\{0, \\frac{1}{2}\\pi, \\frac{3}{2}\\pi, 2\\pi\\right\\}$$",
      value: true,
    },
  ],
  en: [
    {
      label: "$$\\left\\{0, \\frac{1}{2}\\pi, \\pi\\right\\}$$",
      value: false,
    },
    {
      label: "$$\\left\\{0, \\frac{1}{2}\\pi, \\frac{2}{3}\\pi\\right\\}$$",
      value: false,
    },
    {
      label:
        "$$\\left\\{0, \\frac{1}{2}\\pi, \\pi, \\frac{3}{2}\\pi\\right\\}$$",
      value: false,
    },
    {
      label:
        "$$\\left\\{0, \\frac{1}{2}\\pi, \\frac{2}{3}\\pi, 2\\pi\\right\\}$$",
      value: false,
    },
    {
      label:
        "$$\\left\\{0, \\frac{1}{2}\\pi, \\frac{3}{2}\\pi, 2\\pi\\right\\}$$",
      value: true,
    },
  ],
};

export default choices;
