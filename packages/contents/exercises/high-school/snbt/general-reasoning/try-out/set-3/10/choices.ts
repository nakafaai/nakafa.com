import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Kandungan tiap komponen dalam nangka selalu lebih tinggi daripada jeruk bali.",
      value: false,
    },
    {
      label: "Kandungan alpukat selalu lebih tinggi dibandingkan Jeruk bali.",
      value: false,
    },
    {
      label:
        "Jumlah kandungan protein jeruk bali dan nangka lebih tinggi dibandingkan jumlah kandungan protein alpukat dan kedondong.",
      value: false,
    },
    {
      label:
        "Jumlah kandungan kalsium jeruk bali dan alpukat lebih rendah dibandingkan jumlah kandungan kalsium kedondong dan nangka.",
      value: true,
    },
    {
      label: "Buah nangka memiliki kandungan yang paling banyak.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "The content of each component in jackfruit is always higher than in pomelo.",
      value: false,
    },
    {
      label: "Avocado content is always higher than Pomelo.",
      value: false,
    },
    {
      label:
        "The total protein content of pomelo and jackfruit is higher than the total protein content of avocado and ambarella.",
      value: false,
    },
    {
      label:
        "The total calcium content of pomelo and avocado is lower than the total calcium content of ambarella and jackfruit.",
      value: true,
    },
    {
      label: "Jackfruit has the most content.",
      value: false,
    },
  ],
};

export default choices;
