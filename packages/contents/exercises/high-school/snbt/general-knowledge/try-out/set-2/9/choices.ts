import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "melinggarkan.",
      value: false,
    },
    {
      label: "pengurasan.",
      value: true,
    },
    {
      label: "penghabisan.",
      value: false,
    },
    {
      label: "menghabiskan.",
      value: false,
    },
    {
      label: "pengurutan.",
      value: false,
    },
  ],
  en: [
    {
      label: "coiling.",
      value: false,
    },
    {
      label: "draining.",
      value: true,
    },
    {
      label: "exhaustion.",
      value: false,
    },
    {
      label: "spending.",
      value: false,
    },
    {
      label: "sorting.",
      value: false,
    },
  ],
};

export default choices;
