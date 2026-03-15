import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Penjualan celana 10 lebih sedikit dari baju", value: false },
    { label: "Penjualan jas 35 lebih banyak dari celana", value: false },
    { label: "Jumlah penjualan baju dan celana kurang dari 70", value: true },
    { label: "Penjualan baju 10 lebih banyak dari celana", value: false },
    { label: "Penjualan celana 35 lebih sedikit dari jas", value: false },
  ],
  en: [
    { label: "Pants sales are 10 fewer than shirts", value: false },
    { label: "Suits sales are 35 more than pants", value: false },
    {
      label: "The total sales of shirts and pants is less than 70",
      value: true,
    },
    { label: "Shirts sales are 10 more than pants", value: false },
    { label: "Pants sales are 35 less than suits", value: false },
  ],
};

export default choices;
