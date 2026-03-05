import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "kalimat $$(2)$$.",
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
      label: "kalimat $$(7)$$.",
      value: false,
    },
    {
      label: "kalimat $$(9)$$.",
      value: true,
    },
  ],
  en: [
    {
      label: "sentence $$(2)$$.",
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
      label: "sentence $$(7)$$.",
      value: false,
    },
    {
      label: "sentence $$(9)$$.",
      value: true,
    },
  ],
};

export default choices;
