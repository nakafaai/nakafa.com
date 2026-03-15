import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "$$\\left\\{\\frac{2}{7} < x < \\frac{4}{5}, x \\neq \\frac{1}{2}\\right\\}$$",
      value: false,
    },
    {
      label:
        "$$\\left\\{\\frac{2}{7} \\leq x \\leq \\frac{4}{5}, x \\neq \\frac{1}{2}\\right\\}$$",
      value: true,
    },
    {
      label:
        "$$\\left\\{\\frac{2}{5} \\leq x \\leq \\frac{4}{5}, x \\neq \\frac{1}{3}\\right\\}$$",
      value: false,
    },
    {
      label:
        "$$\\left\\{\\frac{1}{5} \\leq x < \\frac{4}{5}, x \\neq \\frac{1}{7}\\right\\}$$",
      value: false,
    },
    {
      label:
        "$$\\left\\{x \\leq \\frac{4}{5} \\vee x \\geq \\frac{1}{5}, x \\neq \\frac{3}{5}\\right\\}$$",
      value: false,
    },
  ],
  en: [
    {
      label:
        "$$\\left\\{\\frac{2}{7} < x < \\frac{4}{5}, x \\neq \\frac{1}{2}\\right\\}$$",
      value: false,
    },
    {
      label:
        "$$\\left\\{\\frac{2}{7} \\leq x \\leq \\frac{4}{5}, x \\neq \\frac{1}{2}\\right\\}$$",
      value: true,
    },
    {
      label:
        "$$\\left\\{\\frac{2}{5} \\leq x \\leq \\frac{4}{5}, x \\neq \\frac{1}{3}\\right\\}$$",
      value: false,
    },
    {
      label:
        "$$\\left\\{\\frac{1}{5} \\leq x < \\frac{4}{5}, x \\neq \\frac{1}{7}\\right\\}$$",
      value: false,
    },
    {
      label:
        "$$\\left\\{x \\leq \\frac{4}{5} \\vee x \\geq \\frac{1}{5}, x \\neq \\frac{3}{5}\\right\\}$$",
      value: false,
    },
  ],
};

export default choices;
