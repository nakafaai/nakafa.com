import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$x < -1$$ atau $$x > \\frac{5}{2}$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{1}{2}$$ atau $$x > 3$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{1}{2}$$ atau $$x > \\frac{5}{2}$$",
      value: true,
    },
    {
      label: "$$x < -1$$ atau $$x > 3$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{3}{2}$$ atau $$x > \\frac{5}{2}$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$x < -1$$ or $$x > \\frac{5}{2}$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{1}{2}$$ or $$x > 3$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{1}{2}$$ or $$x > \\frac{5}{2}$$",
      value: true,
    },
    {
      label: "$$x < -1$$ or $$x > 3$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{3}{2}$$ or $$x > \\frac{5}{2}$$",
      value: false,
    },
  ],
};

export default choices;
