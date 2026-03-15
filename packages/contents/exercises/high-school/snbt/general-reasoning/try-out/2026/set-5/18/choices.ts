import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Pertumbuhan ekonomi Indonesia sejak tahun $$2013$$ hingga tahun $$2018$$ selalu mengalami penurunan",
      value: false,
    },
    {
      label:
        "Setelah tahun $$2013$$ dan sebelum tahun $$2018$$, ekonomi Indonesia tidak pernah mengalami penurunan pertumbuhan",
      value: false,
    },
    {
      label:
        "Pertumbuhan perekonomian Indonesia tidak menunjukkan tren yang membaik sejak lima tahun terakhir",
      value: false,
    },
    {
      label:
        "Penurunan pertumbuhan ekonomi Indonesia dari tahun $$2014$$ ke $$2015$$ lebih besar daripada kenaikan dari tahun $$2015$$ ke $$2016$$",
      value: false,
    },
    {
      label:
        "Selama enam tahun tersebut, pertumbuhan perekonomian Indonesia tahun $$2013$$ selalu lebih tinggi daripada tahun berikutnya",
      value: true,
    },
  ],
  en: [
    {
      label:
        "Indonesia's economic growth from $$2013$$ to $$2018$$ always experienced a decline",
      value: false,
    },
    {
      label:
        "After $$2013$$ and before $$2018$$, Indonesia's economy never experienced a decline in growth",
      value: false,
    },
    {
      label:
        "Indonesia's economic growth has not shown an improving trend in the last five years",
      value: false,
    },
    {
      label:
        "The decline in Indonesia's economic growth from $$2014$$ to $$2015$$ was greater than the increase from $$2015$$ to $$2016$$",
      value: false,
    },
    {
      label:
        "During those six years, Indonesia's economic growth in $$2013$$ was always higher than in the following years",
      value: true,
    },
  ],
};

export default choices;
