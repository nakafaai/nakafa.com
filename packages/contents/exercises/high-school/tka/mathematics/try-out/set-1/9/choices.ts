import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$(f \\circ g)(x) = 18x^2 - 12x - 21$$",
      value: false,
    },
    {
      label: "$$(f \\circ g)(x) = 18x^2 + 10x - 21$$",
      value: false,
    },
    {
      label: "$$(f \\circ g)(x) = 18x^2 - 12x - 1$$",
      value: true,
    },
    {
      label: "$$(f \\circ g)(x) = 9x^2 - 6x - 2$$",
      value: false,
    },
    {
      label: "$$(f \\circ g)(x) = 9x^2 - 6x + 2$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$(f \\circ g)(x) = 18x^2 - 12x - 21$$",
      value: false,
    },
    {
      label: "$$(f \\circ g)(x) = 18x^2 + 10x - 21$$",
      value: false,
    },
    {
      label: "$$(f \\circ g)(x) = 18x^2 - 12x - 1$$",
      value: true,
    },
    {
      label: "$$(f \\circ g)(x) = 9x^2 - 6x - 2$$",
      value: false,
    },
    {
      label: "$$(f \\circ g)(x) = 9x^2 - 6x + 2$$",
      value: false,
    },
  ],
};

export default choices;
