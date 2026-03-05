import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "mengancam (kalimat $$(2)$$).",
      value: false,
    },
    {
      label: "risiko (kalimat $$(3)$$).",
      value: false,
    },
    {
      label: "dikarenakan (kalimat $$(4)$$).",
      value: true,
    },
    {
      label: "deteriorasi (kalimat $$(5)$$).",
      value: false,
    },
    {
      label: "sumber daya (kalimat $$(6)$$).",
      value: false,
    },
  ],
  en: [
    {
      label: "threatened (sentence $$(2)$$).",
      value: false,
    },
    {
      label: "risk (sentence $$(3)$$).",
      value: false,
    },
    {
      label: "resulted by (sentence $$(4)$$).",
      value: true,
    },
    {
      label: "deterioration (sentence $$(5)$$).",
      value: false,
    },
    {
      label: "resources (sentence $$(6)$$).",
      value: false,
    },
  ],
};

export default choices;
