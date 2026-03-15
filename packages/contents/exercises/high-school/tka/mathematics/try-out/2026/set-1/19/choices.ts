import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$y = -\\sin(2x + 60^\\circ)$$",
      value: false,
    },
    {
      label: "$$y = \\sin(2x + 60^\\circ)$$",
      value: true,
    },
    {
      label: "$$y = \\cos(2x + 60^\\circ)$$",
      value: false,
    },
    {
      label: "$$y = \\sin(2x - 60^\\circ)$$",
      value: false,
    },
    {
      label: "$$y = \\cos(2x - 60^\\circ)$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$y = -\\sin(2x + 60^\\circ)$$",
      value: false,
    },
    {
      label: "$$y = \\sin(2x + 60^\\circ)$$",
      value: true,
    },
    {
      label: "$$y = \\cos(2x + 60^\\circ)$$",
      value: false,
    },
    {
      label: "$$y = \\sin(2x - 60^\\circ)$$",
      value: false,
    },
    {
      label: "$$y = \\cos(2x - 60^\\circ)$$",
      value: false,
    },
  ],
};

export default choices;
