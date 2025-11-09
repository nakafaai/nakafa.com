import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$P(Z < 1) - P(Z < -1)$$",
      value: true,
    },
    {
      label: "$$P(Z < 2) - P(Z < -2)$$",
      value: false,
    },
    {
      label: "$$P(Z < 1) + P(Z < -1)$$",
      value: false,
    },
    {
      label: "$$P(Z < 2) + P(Z < -2)$$",
      value: false,
    },
    {
      label: "$$P(Z < 0) - P(Z < -1)$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$P(Z < 1) - P(Z < -1)$$",
      value: true,
    },
    {
      label: "$$P(Z < 2) - P(Z < -2)$$",
      value: false,
    },
    {
      label: "$$P(Z < 1) + P(Z < -1)$$",
      value: false,
    },
    {
      label: "$$P(Z < 2) + P(Z < -2)$$",
      value: false,
    },
    {
      label: "$$P(Z < 0) - P(Z < -1)$$",
      value: false,
    },
  ],
};

export default choices;
