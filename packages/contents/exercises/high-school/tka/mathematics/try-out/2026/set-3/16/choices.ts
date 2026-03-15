import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$x < 0$$ atau $$x > 1$$",
      value: false,
    },
    {
      label: "$$-1 < x < 2; x \\neq 1; x \\neq 0$$",
      value: false,
    },
    {
      label: "$$-1 \\leq x < 0$$ atau $$1 < x \\leq 2$$",
      value: true,
    },
    {
      label: "$$-1 \\leq x \\leq 0$$ atau $$1 \\leq x \\leq 2$$",
      value: false,
    },
    {
      label: "$$-1 < x < 0$$ atau $$1 \\leq x < 2$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$x < 0$$ or $$x > 1$$",
      value: false,
    },
    {
      label: "$$-1 < x < 2; x \\neq 1; x \\neq 0$$",
      value: false,
    },
    {
      label: "$$-1 \\leq x < 0$$ or $$1 < x \\leq 2$$",
      value: true,
    },
    {
      label: "$$-1 \\leq x \\leq 0$$ or $$1 \\leq x \\leq 2$$",
      value: false,
    },
    {
      label: "$$-1 < x < 0$$ or $$1 \\leq x < 2$$",
      value: false,
    },
  ],
};

export default choices;
