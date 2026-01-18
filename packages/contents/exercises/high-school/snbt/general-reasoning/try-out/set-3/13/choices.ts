import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Banyak kerudung jenis bergo yang terjual adalah $$24$$ buah.",
      value: false,
    },
    {
      label:
        "Kerudung jenis pasmina paling banyak terjual yaitu sebesar $$35$$ buah.",
      value: false,
    },
    {
      label: "Penjualan jenis kerudung segiempat adalah sebanyak $$42$$ buah.",
      value: true,
    },
    {
      label:
        "Kerudung jenis pasmina lebih sedikit terjual dibandingkan kerudung jenis bergo.",
      value: false,
    },
    {
      label: "Kerudung jenis bergo adalah kerudung yang paling banyak terjual.",
      value: false,
    },
  ],
  en: [
    {
      label: "The number of bergo veils sold is $$24$$ pieces.",
      value: false,
    },
    {
      label:
        "Pashmina veils are the best-selling type with $$35$$ pieces sold.",
      value: false,
    },
    {
      label: "Sales of square veils are $$42$$ pieces.",
      value: true,
    },
    {
      label: "Pashmina veils are sold less than bergo veils.",
      value: false,
    },
    {
      label: "Bergo veils are the best-selling type of veil.",
      value: false,
    },
  ],
};

export default choices;
