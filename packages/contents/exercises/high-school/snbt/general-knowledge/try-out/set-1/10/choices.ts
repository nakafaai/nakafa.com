import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "pertumbuhan.",
      value: false,
    },
    {
      label: "progresif.",
      value: false,
    },
    {
      label: "menurun.",
      value: true,
    },
    {
      label: "menaiki.",
      value: false,
    },
    {
      label: "meninggi.",
      value: false,
    },
  ],
  en: [
    {
      label: "growth.",
      value: false,
    },
    {
      label: "progressive.",
      value: false,
    },
    {
      label: "decrease.",
      value: true,
    },
    {
      label: "climbing.",
      value: false,
    },
    {
      label: "rising.",
      value: false,
    },
  ],
};

export default choices;
