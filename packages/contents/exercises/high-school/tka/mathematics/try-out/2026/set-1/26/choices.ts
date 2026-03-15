import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$30$$",
      value: false,
    },
    {
      label: "$$20$$",
      value: false,
    },
    {
      label: "$$12$$",
      value: false,
    },
    {
      label: "$$-12$$",
      value: false,
    },
    {
      label: "$$-30$$",
      value: true,
    },
  ],
  en: [
    {
      label: "$$30$$",
      value: false,
    },
    {
      label: "$$20$$",
      value: false,
    },
    {
      label: "$$12$$",
      value: false,
    },
    {
      label: "$$-12$$",
      value: false,
    },
    {
      label: "$$-30$$",
      value: true,
    },
  ],
};

export default choices;
