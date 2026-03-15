import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "kalimat $$(1)$$.",
      value: false,
    },
    {
      label: "kalimat $$(5)$$.",
      value: false,
    },
    {
      label: "kalimat $$(6)$$.",
      value: false,
    },
    {
      label: "kalimat $$(8)$$.",
      value: false,
    },
    {
      label: "kalimat $$(10)$$.",
      value: true,
    },
  ],
  en: [
    {
      label: "sentence $$(1)$$.",
      value: false,
    },
    {
      label: "sentence $$(5)$$.",
      value: false,
    },
    {
      label: "sentence $$(6)$$.",
      value: false,
    },
    {
      label: "sentence $$(8)$$.",
      value: false,
    },
    {
      label: "sentence $$(10)$$.",
      value: true,
    },
  ],
};

export default choices;
