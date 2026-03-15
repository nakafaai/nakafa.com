import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Penjualan kerudung jenis pasmina selalu lebih sedikit dibandingkan penjualan kerudung jenis segiempat.",
      value: false,
    },
    {
      label:
        "Penjualan kerudung jenis bergo selalu lebih tinggi dibandingkan penjualan kerudung jenis segiempat.",
      value: true,
    },
    {
      label:
        "Banyak penjualan kerudung jenis bergo mengikuti pola barisan aritmetika.",
      value: false,
    },
    {
      label:
        "Tingkat penjualan jenis kerudung tiap minggu selalu lebih tinggi dibandingkan minggu sebelumnya.",
      value: false,
    },
    {
      label:
        "Penjualan kerudung jenis bergo mengalami kenaikan yang paling kecil.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Sales of pashmina veils are always lower than sales of square veils.",
      value: false,
    },
    {
      label:
        "Sales of bergo veils are always higher than sales of square veils.",
      value: true,
    },
    {
      label:
        "The number of bergo veil sales follows an arithmetic progression pattern.",
      value: false,
    },
    {
      label:
        "The sales level of each veil type every week is always higher than the previous week.",
      value: false,
    },
    {
      label: "Bergo veil sales experience the smallest increase.",
      value: false,
    },
  ],
};

export default choices;
