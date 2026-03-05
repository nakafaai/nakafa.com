import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "setelah kalimat $$(2)$$.",
      value: true,
    },
    {
      label: "sebelum kalimat $$(5)$$.",
      value: false,
    },
    {
      label: "setelah kalimat $$(4)$$.",
      value: false,
    },
    {
      label: "sebelum kalimat $$(6)$$.",
      value: false,
    },
    {
      label: "setelah kalimat $$(7)$$.",
      value: false,
    },
  ],
  en: [
    {
      label: "after sentence $$(2)$$.",
      value: true,
    },
    {
      label: "before sentence $$(5)$$.",
      value: false,
    },
    {
      label: "after sentence $$(4)$$.",
      value: false,
    },
    {
      label: "before sentence $$(6)$$.",
      value: false,
    },
    {
      label: "after sentence $$(7)$$.",
      value: false,
    },
  ],
};

export default choices;
