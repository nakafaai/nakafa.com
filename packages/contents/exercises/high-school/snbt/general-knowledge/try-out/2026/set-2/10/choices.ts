import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "interferensi.",
      value: false,
    },
    {
      label: "persentuhan.",
      value: false,
    },
    {
      label: "diskriminatif.",
      value: true,
    },
    {
      label: "penambahan.",
      value: false,
    },
    {
      label: "ketidaksenangan.",
      value: false,
    },
  ],
  en: [
    {
      label: "interference.",
      value: false,
    },
    {
      label: "contact.",
      value: false,
    },
    {
      label: "discriminatory.",
      value: true,
    },
    {
      label: "addition.",
      value: false,
    },
    {
      label: "displeasure.",
      value: false,
    },
  ],
};

export default choices;
