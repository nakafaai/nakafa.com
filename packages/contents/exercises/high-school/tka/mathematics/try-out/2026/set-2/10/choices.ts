import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$1 - (-1)^n$$",
      value: false,
    },
    {
      label: "$$1 + (-1)^n$$",
      value: false,
    },
    {
      label: "$$-(-1)^n$$",
      value: true,
    },
    {
      label: "$$2(-1)^n$$",
      value: false,
    },
    {
      label: "$$-1$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$1 - (-1)^n$$",
      value: false,
    },
    {
      label: "$$1 + (-1)^n$$",
      value: false,
    },
    {
      label: "$$-(-1)^n$$",
      value: true,
    },
    {
      label: "$$2(-1)^n$$",
      value: false,
    },
    {
      label: "$$-1$$",
      value: false,
    },
  ],
};

export default choices;
