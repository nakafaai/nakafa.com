import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "kalimat $$(2)$$.",
      value: false,
    },
    {
      label: "kalimat $$(4)$$.",
      value: false,
    },
    {
      label: "kalimat $$(12)$$.",
      value: true,
    },
    {
      label: "kalimat $$(13)$$.",
      value: false,
    },
    {
      label: "kalimat $$(15)$$.",
      value: false,
    },
  ],
  en: [
    {
      label: "sentence $$(2)$$.",
      value: false,
    },
    {
      label: "sentence $$(4)$$.",
      value: false,
    },
    {
      label: "sentence $$(12)$$.",
      value: true,
    },
    {
      label: "sentence $$(13)$$.",
      value: false,
    },
    {
      label: "sentence $$(15)$$.",
      value: false,
    },
  ],
};

export default choices;
