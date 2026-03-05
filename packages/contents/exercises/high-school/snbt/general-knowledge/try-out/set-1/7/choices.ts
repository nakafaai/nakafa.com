import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "kata *menemukan* pada kalimat $$(3)$$.",
      value: false,
    },
    {
      label: "kata *tertanggal* pada kalimat $$(4)$$.",
      value: false,
    },
    {
      label: "kata *temuan* pada kalimat $$(5)$$.",
      value: false,
    },
    {
      label: "kata *penelitian* pada kalimat $$(6)$$.",
      value: true,
    },
    {
      label: "kata *menderita* pada kalimat $$(8)$$.",
      value: false,
    },
  ],
  en: [
    {
      label: "the word *menemukan* in sentence $$(3)$$.",
      value: false,
    },
    {
      label: "the word *tertanggal* in sentence $$(4)$$.",
      value: false,
    },
    {
      label: "the word *temuan* in sentence $$(5)$$.",
      value: false,
    },
    {
      label: "the word *penelitian* in sentence $$(6)$$.",
      value: true,
    },
    {
      label: "the word *menderita* in sentence $$(8)$$.",
      value: false,
    },
  ],
};

export default choices;
