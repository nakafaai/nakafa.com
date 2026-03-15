import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "sebelum kalimat 1.",
      value: false,
    },
    {
      label: "setelah kalimat 1.",
      value: false,
    },
    {
      label: "setelah kalimat 2.",
      value: false,
    },
    {
      label: "setelah kalimat 3.",
      value: true,
    },
    {
      label: "setelah kalimat 4.",
      value: false,
    },
  ],
  en: [
    {
      label: "before sentence 1.",
      value: false,
    },
    {
      label: "after sentence 1.",
      value: false,
    },
    {
      label: "after sentence 2.",
      value: false,
    },
    {
      label: "after sentence 3.",
      value: true,
    },
    {
      label: "after sentence 4.",
      value: false,
    },
  ],
};

export default choices;
