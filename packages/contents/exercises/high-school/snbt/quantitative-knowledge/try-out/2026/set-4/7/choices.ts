import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "1, 2, 3",
      value: true,
    },
    {
      label: "1 dan 3",
      value: false,
    },
    {
      label: "2 dan 4",
      value: false,
    },
    {
      label: "4 saja",
      value: false,
    },
    {
      label: "semua",
      value: false,
    },
  ],
  en: [
    {
      label: "1, 2, 3",
      value: true,
    },
    {
      label: "1 and 3",
      value: false,
    },
    {
      label: "2 and 4",
      value: false,
    },
    {
      label: "4 only",
      value: false,
    },
    {
      label: "all",
      value: false,
    },
  ],
};

export default choices;
