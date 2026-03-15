import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$\\log_2 3 - 1$$",
      value: true,
    },
    {
      label: "$$\\log_2 3$$",
      value: false,
    },
    {
      label: "$$1 - \\log_2 3$$",
      value: false,
    },
    {
      label: "$$-1 - \\log_2 3$$",
      value: false,
    },
    {
      label: "$$\\log_2 3 + \\log_3 2$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\log_2 3 - 1$$",
      value: true,
    },
    {
      label: "$$\\log_2 3$$",
      value: false,
    },
    {
      label: "$$1 - \\log_2 3$$",
      value: false,
    },
    {
      label: "$$-1 - \\log_2 3$$",
      value: false,
    },
    {
      label: "$$\\log_2 3 + \\log_3 2$$",
      value: false,
    },
  ],
};

export default choices;
