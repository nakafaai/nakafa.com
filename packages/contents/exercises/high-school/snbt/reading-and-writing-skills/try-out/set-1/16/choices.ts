import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "penjualan mobil.",
      value: false,
    },
    {
      label: "pasar mobil bekas.",
      value: false,
    },
    {
      label: "penurunan drastis.",
      value: false,
    },
    {
      label: "akibat pandemi.",
      value: false,
    },
    {
      label: "penjualan kendaraan.",
      value: true,
    },
  ],
  en: [
    {
      label: "car sales.",
      value: false,
    },
    {
      label: "the used car market.",
      value: false,
    },
    {
      label: "a drastic decline.",
      value: false,
    },
    {
      label: "the impact of the pandemic.",
      value: false,
    },
    {
      label: "vehicle sales.",
      value: true,
    },
  ],
};

export default choices;
