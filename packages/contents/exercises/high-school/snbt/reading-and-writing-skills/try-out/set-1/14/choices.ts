import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "kalimat $$(3)$$.",
      value: false,
    },
    {
      label: "kalimat $$(4)$$.",
      value: true,
    },
    {
      label: "kalimat $$(7)$$.",
      value: false,
    },
    {
      label: "kalimat $$(8)$$.",
      value: false,
    },
    {
      label: "kalimat $$(11)$$.",
      value: false,
    },
  ],
  en: [
    {
      label: "sentence $$(3)$$.",
      value: false,
    },
    {
      label: "sentence $$(4)$$.",
      value: true,
    },
    {
      label: "sentence $$(7)$$.",
      value: false,
    },
    {
      label: "sentence $$(8)$$.",
      value: false,
    },
    {
      label: "sentence $$(11)$$.",
      value: false,
    },
  ],
};

export default choices;
