import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "namun.",
      value: false,
    },
    {
      label: "sehingga.",
      value: true,
    },
    {
      label: "bahkan.",
      value: false,
    },
    {
      label: "kemudian.",
      value: false,
    },
    {
      label: "oleh karena itu.",
      value: false,
    },
  ],
  en: [
    {
      label: "however.",
      value: false,
    },
    {
      label: "so.",
      value: true,
    },
    {
      label: "even.",
      value: false,
    },
    {
      label: "then.",
      value: false,
    },
    {
      label: "therefore.",
      value: false,
    },
  ],
};

export default choices;
