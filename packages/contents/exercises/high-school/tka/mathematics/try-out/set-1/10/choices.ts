import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "$$(f \\circ g)^{-1}(x) = \\frac{6x + 11}{3x + 4}, x \\neq -\\frac{4}{3}$$",
      value: false,
    },
    {
      label:
        "$$(f \\circ g)^{-1}(x) = \\frac{6x - 11}{3x + 4}, x \\neq -\\frac{4}{3}$$",
      value: false,
    },
    {
      label:
        "$$(f \\circ g)^{-1}(x) = \\frac{6x - 6}{3x + 4}, x \\neq -\\frac{4}{3}$$",
      value: false,
    },
    {
      label: "$$(f \\circ g)^{-1}(x) = \\frac{11 - 4x}{3x - 6}, x \\neq 2$$",
      value: true,
    },
    {
      label: "$$(f \\circ g)^{-1}(x) = \\frac{4x - 11}{3x - 6}, x \\neq 2$$",
      value: false,
    },
  ],
  en: [
    {
      label:
        "$$(f \\circ g)^{-1}(x) = \\frac{6x + 11}{3x + 4}, x \\neq -\\frac{4}{3}$$",
      value: false,
    },
    {
      label:
        "$$(f \\circ g)^{-1}(x) = \\frac{6x - 11}{3x + 4}, x \\neq -\\frac{4}{3}$$",
      value: false,
    },
    {
      label:
        "$$(f \\circ g)^{-1}(x) = \\frac{6x - 6}{3x + 4}, x \\neq -\\frac{4}{3}$$",
      value: false,
    },
    {
      label: "$$(f \\circ g)^{-1}(x) = \\frac{11 - 4x}{3x - 6}, x \\neq 2$$",
      value: true,
    },
    {
      label: "$$(f \\circ g)^{-1}(x) = \\frac{4x - 11}{3x - 6}, x \\neq 2$$",
      value: false,
    },
  ],
};

export default choices;
