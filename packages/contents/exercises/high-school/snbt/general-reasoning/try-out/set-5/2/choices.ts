import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Luas panen di tahun 2018 lebih dari dua kali lipat luas panen di tahun 2016",
      value: false,
    },
    {
      label:
        "Produksi bawang putih di tahun 2018 dua kali lipat dari produksi bawang putih di tahun 2017",
      value: false,
    },
    {
      label:
        "Periode 2015–2017, luas panen bawang putih mengalami penurunan terus menerus",
      value: false,
    },
    {
      label:
        "Pada tahun 2017 terjadi penurunan dalam luas panen, produksi dan impor bawang putih",
      value: true,
    },
    {
      label:
        "Terjadi kenaikan terus menerus pada jumlah impor bawang putih di dua tahun terakhir",
      value: false,
    },
  ],
  en: [
    {
      label:
        "The harvest area in 2018 was more than double the harvest area in 2016",
      value: false,
    },
    {
      label:
        "Garlic production in 2018 was double the garlic production in 2017",
      value: false,
    },
    {
      label:
        "In the 2015–2017 period, the garlic harvest area decreased continuously",
      value: false,
    },
    {
      label:
        "In 2017, there was a decrease in harvest area, production, and import of garlic",
      value: true,
    },
    {
      label:
        "There was a continuous increase in the amount of garlic imports in the last two years",
      value: false,
    },
  ],
};

export default choices;
