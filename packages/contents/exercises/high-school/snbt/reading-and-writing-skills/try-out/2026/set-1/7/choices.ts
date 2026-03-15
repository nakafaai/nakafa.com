import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "kalimat $$(7)$$.",
      value: false,
    },
    {
      label: "kalimat $$(6)$$.",
      value: false,
    },
    {
      label: "kalimat $$(5)$$.",
      value: false,
    },
    {
      label: "kalimat $$(4)$$.",
      value: true,
    },
    {
      label: "kalimat $$(3)$$.",
      value: false,
    },
  ],
  en: [
    {
      label: "sentence $$(7)$$.",
      value: false,
    },
    {
      label: "sentence $$(6)$$.",
      value: false,
    },
    {
      label: "sentence $$(5)$$.",
      value: false,
    },
    {
      label: "sentence $$(4)$$.",
      value: true,
    },
    {
      label: "sentence $$(3)$$.",
      value: false,
    },
  ],
};

export default choices;
