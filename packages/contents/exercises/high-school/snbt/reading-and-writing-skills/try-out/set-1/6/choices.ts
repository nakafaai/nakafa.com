import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

export const choices: ExercisesChoices = {
  id: [
    {
      label: "Selanjutnya.",
      value: false,
    },
    {
      label: "Selain itu.",
      value: true,
    },
    {
      label: "Karena itu.",
      value: false,
    },
    {
      label: "Faktanya.",
      value: false,
    },
    {
      label: "Misalnya.",
      value: false,
    },
  ],
  en: [
    {
      label: "Furthermore.",
      value: false,
    },
    {
      label: "In addition.",
      value: true,
    },
    {
      label: "Therefore.",
      value: false,
    },
    {
      label: "In fact.",
      value: false,
    },
    {
      label: "For example.",
      value: false,
    },
  ],
};

export default choices;
