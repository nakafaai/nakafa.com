import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "bahkan.",
      value: false,
    },
    {
      label: "dan.",
      value: false,
    },
    {
      label: "bahwa.",
      value: true,
    },
    {
      label: "ketika.",
      value: false,
    },
    {
      label: "seandainya.",
      value: false,
    },
  ],
  en: [
    {
      label: "even.",
      value: false,
    },
    {
      label: "and.",
      value: false,
    },
    {
      label: "that.",
      value: true,
    },
    {
      label: "when.",
      value: false,
    },
    {
      label: "if.",
      value: false,
    },
  ],
};

export default choices;
