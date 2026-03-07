import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "tetapi.",
      value: true,
    },
    {
      label: "akan tetapi.",
      value: false,
    },
    {
      label: "bahwa.",
      value: false,
    },
    {
      label: "sehingga.",
      value: false,
    },
    {
      label: "karena.",
      value: false,
    },
  ],
  en: [
    {
      label: "but.",
      value: true,
    },
    {
      label: "however.",
      value: false,
    },
    {
      label: "that.",
      value: false,
    },
    {
      label: "so.",
      value: false,
    },
    {
      label: "because.",
      value: false,
    },
  ],
};

export default choices;
