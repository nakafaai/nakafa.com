import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "mungkin.",
      value: false,
    },
    {
      label: "layak.",
      value: false,
    },
    {
      label: "gabung.",
      value: false,
    },
    {
      label: "banyak.",
      value: false,
    },
    {
      label: "lumrah.",
      value: true,
    },
  ],
  en: [
    {
      label: "possible.",
      value: false,
    },
    {
      label: "proper.",
      value: false,
    },
    {
      label: "combine.",
      value: false,
    },
    {
      label: "many.",
      value: false,
    },
    {
      label: "common.",
      value: true,
    },
  ],
};

export default choices;
