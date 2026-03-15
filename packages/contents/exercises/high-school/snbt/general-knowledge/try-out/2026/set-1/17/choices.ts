import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "gugur.",
      value: true,
    },
    {
      label: "paman.",
      value: false,
    },
    {
      label: "bangsa.",
      value: false,
    },
    {
      label: "pahlawan.",
      value: false,
    },
    {
      label: "musuh.",
      value: false,
    },
  ],
  en: [
    {
      label: "fell.",
      value: true,
    },
    {
      label: "uncle.",
      value: false,
    },
    {
      label: "nation.",
      value: false,
    },
    {
      label: "hero.",
      value: false,
    },
    {
      label: "enemy.",
      value: false,
    },
  ],
};

export default choices;
