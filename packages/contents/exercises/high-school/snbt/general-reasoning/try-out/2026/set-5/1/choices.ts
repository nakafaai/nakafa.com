import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Masyarakat memilih mengonsumsi telur ayam ras", value: false },
    { label: "Harga telur ayam naik terus-menerus", value: false },
    { label: "Pendistribusian tersendat", value: false },
    {
      label: "Produksi telur minim sedangkan permintaan makin banyak",
      value: false,
    },
    { label: "Jumlah peternak ayam bertambah", value: true },
  ],
  en: [
    {
      label: "The community chooses to consume purebred chicken eggs",
      value: false,
    },
    { label: "The price of chicken eggs keeps rising", value: false },
    { label: "Distribution is disrupted", value: false },
    {
      label: "Egg production is minimal while demand is increasing",
      value: false,
    },
    { label: "The number of chicken farmers is increasing", value: true },
  ],
};

export default choices;
