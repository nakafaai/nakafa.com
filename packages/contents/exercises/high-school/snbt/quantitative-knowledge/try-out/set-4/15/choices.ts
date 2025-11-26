import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$P > Q$$",
      value: true,
    },
    {
      label: "$$P < Q$$",
      value: false,
    },
    {
      label: "$$P = Q$$",
      value: false,
    },
    {
      label: "$$PQ = 1$$",
      value: false,
    },
    {
      label: "Tidak dapat ditentukan",
      value: false,
    },
  ],
  en: [
    {
      label: "$$P > Q$$",
      value: true,
    },
    {
      label: "$$P < Q$$",
      value: false,
    },
    {
      label: "$$P = Q$$",
      value: false,
    },
    {
      label: "$$PQ = 1$$",
      value: false,
    },
    {
      label: "Cannot be determined",
      value: false,
    },
  ],
};

export default choices;
