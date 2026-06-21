import type { ExercisesChoices } from "@repo/contents/_types/assessment/choices";

// Date: 2025-11-23
const choices: ExercisesChoices = {
  id: [
    {
      label: "$$x - 5$$",
      value: false,
    },
    {
      label: "$$x + 5$$",
      value: false,
    },
    {
      label: "$$5 - x$$",
      value: true,
    },
    {
      label: "$$5 - 2x$$",
      value: false,
    },
    {
      label: "$$2x - 5$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$x - 5$$",
      value: false,
    },
    {
      label: "$$x + 5$$",
      value: false,
    },
    {
      label: "$$5 - x$$",
      value: true,
    },
    {
      label: "$$5 - 2x$$",
      value: false,
    },
    {
      label: "$$2x - 5$$",
      value: false,
    },
  ],
};

export default choices;
