import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$\\frac{2}{3} \\leq x \\leq 1$$",
      value: false,
    },
    {
      label: "$$x \\leq \\frac{2}{3}$$ atau $$x \\geq 1$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2} < x \\leq \\frac{2}{3}$$ atau $$1 \\leq x < 2$$",
      value: true,
    },
    {
      label:
        "$$\\frac{1}{2} \\leq x \\leq \\frac{2}{3}$$ atau $$1 \\leq x \\leq 2$$",
      value: false,
    },
    {
      label: "$$x \\leq \\frac{1}{2}$$ atau $$x > 2$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\frac{2}{3} \\leq x \\leq 1$$",
      value: false,
    },
    {
      label: "$$x \\leq \\frac{2}{3}$$ or $$x \\geq 1$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2} < x \\leq \\frac{2}{3}$$ or $$1 \\leq x < 2$$",
      value: true,
    },
    {
      label:
        "$$\\frac{1}{2} \\leq x \\leq \\frac{2}{3}$$ or $$1 \\leq x \\leq 2$$",
      value: false,
    },
    {
      label: "$$x \\leq \\frac{1}{2}$$ or $$x > 2$$",
      value: false,
    },
  ],
};

export default choices;
