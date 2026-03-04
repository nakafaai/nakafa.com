import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "hewan yang dimangsa.",
      value: false,
    },
    {
      label: "hewan kecil yang dimakan oleh hewan lainnya.",
      value: false,
    },
    {
      label: "serangga kecil.",
      value: false,
    },
    {
      label: "serangga dan hewan kecil lainnya.",
      value: false,
    },
    {
      label: "hewan pemangsa hewan lainnya.",
      value: true,
    },
  ],
  en: [
    {
      label: "animals that are preyed upon.",
      value: false,
    },
    {
      label: "small animals that are eaten by other animals.",
      value: false,
    },
    {
      label: "small insects.",
      value: false,
    },
    {
      label: "insects and other small animals.",
      value: false,
    },
    {
      label: "animals that prey on other animals.",
      value: true,
    },
  ],
};

export default choices;
