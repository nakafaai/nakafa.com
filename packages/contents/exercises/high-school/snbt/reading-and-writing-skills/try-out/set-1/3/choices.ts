import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

export const choices: ExercisesChoices = {
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
};

export default choices;
