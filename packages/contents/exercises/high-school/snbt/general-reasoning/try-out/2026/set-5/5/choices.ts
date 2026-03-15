import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Penjualan sepeda motor pabrik X sebanyak $$500.000$$ unit",
      value: false,
    },
    {
      label: "Penjualan sepeda motor pabrik Y sebanyak $$5.200.000$$ unit",
      value: false,
    },
    {
      label: "Penjualan sepeda motor pabrik Z sebanyak $$250.000$$ unit",
      value: true,
    },
    {
      label:
        "Penjualan sepeda motor pabrik Y sebanyak empat kali lipat penjualan sepeda motor X di tahun 2016",
      value: false,
    },
    {
      label:
        "Selisih penjualan sepeda motor di pabrik X sebesar $$800.000$$ unit",
      value: false,
    },
  ],
  en: [
    { label: "Factory X motorcycle sales of $$500,000$$ units", value: false },
    {
      label: "Factory Y motorcycle sales of $$5,200,000$$ units",
      value: false,
    },
    { label: "Factory Z motorcycle sales of $$250,000$$ units", value: true },
    {
      label:
        "Factory Y motorcycle sales are four times Factory X sales in 2016",
      value: false,
    },
    {
      label:
        "The difference in Factory X motorcycle sales is $$800,000$$ units",
      value: false,
    },
  ],
};

export default choices;
