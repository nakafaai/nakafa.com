import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$-\\frac{3}{2} < x < 1$$",
      value: true,
    },
    {
      label: "$$-\\frac{5}{2} < x < 3$$",
      value: false,
    },
    {
      label: "$$-\\frac{7}{2} < x < 5$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{3}{2} \\cup x > 2$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{5}{2} \\cup x > 3$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$-\\frac{3}{2} < x < 1$$",
      value: true,
    },
    {
      label: "$$-\\frac{5}{2} < x < 3$$",
      value: false,
    },
    {
      label: "$$-\\frac{7}{2} < x < 5$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{3}{2} \\cup x > 2$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{5}{2} \\cup x > 3$$",
      value: false,
    },
  ],
};

export default choices;
