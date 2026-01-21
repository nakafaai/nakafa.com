import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Kenaikan penjualan sepeda motor di pabrik Y membentuk suatu barisan aritmatika tingkat dua",
      value: false,
    },
    {
      label:
        "Kenaikan penjualan sepeda motor di Pabrik Z membentuk pola barisan geometri",
      value: false,
    },
    {
      label:
        "Persentase penurunan penjualan sepeda motor tertinggi salah satunya di pabrik Z pada tahun 2015-2016",
      value: false,
    },
    {
      label:
        "Penjualan sepeda motor di pabrik Y lebih dari dua kali lipat jumlah penjualan sepeda motor di pabrik X dan Z",
      value: false,
    },
    {
      label:
        "Persentase penurunan penjualan sepeda motor di pabrik X tertinggi pada tahun 2014-2015",
      value: true,
    },
  ],
  en: [
    {
      label:
        "The increase in motorcycle sales at factory Y forms a second-level arithmetic sequence",
      value: false,
    },
    {
      label:
        "The increase in motorcycle sales at Factory Z forms a geometric sequence pattern",
      value: false,
    },
    {
      label:
        "One of the highest percentage decreases in motorcycle sales occurred at factory Z in 2015-2016",
      value: false,
    },
    {
      label:
        "Motorcycle sales at factory Y are more than double the total sales of factory X and Z",
      value: false,
    },
    {
      label:
        "The highest percentage decrease in motorcycle sales at factory X occurred in 2014-2015",
      value: true,
    },
  ],
};

export default choices;
