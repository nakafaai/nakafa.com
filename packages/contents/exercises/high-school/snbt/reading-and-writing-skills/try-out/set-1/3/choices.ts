import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "produk.",
      value: false,
    },
    {
      label: "produktif.",
      value: false,
    },
    {
      label: "produksi.",
      value: false,
    },
    {
      label: "produsen.",
      value: false,
    },
    {
      label: "produktivitas.",
      value: true,
    },
  ],
  en: [
    {
      label: "product.",
      value: false,
    },
    {
      label: "productive.",
      value: false,
    },
    {
      label: "production.",
      value: false,
    },
    {
      label: "producer.",
      value: false,
    },
    {
      label: "productivity.",
      value: true,
    },
  ],
};

export default choices;
