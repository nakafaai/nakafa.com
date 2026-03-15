import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Produk Mie A tidak pernah mengalami penurunan harga",
      value: false,
    },
    {
      label:
        "Kenaikan harga Mie B pada tahun 2019—2020 lebih tinggi dibandingkan kenaikan harga Mie B dari tahun 2017—2019",
      value: false,
    },
    {
      label: "Ada produk Mie yang hanya mengalami satu kali penurunan harga",
      value: true,
    },
    {
      label:
        "Hampir semua produk mie Instan sering kali mengalami kenaikan harga",
      value: false,
    },
    {
      label: "Harga Mie A tidak mengalami penurunan harga secara drastis",
      value: false,
    },
  ],
  en: [
    {
      label: "Product Noodle A never experienced a price decrease",
      value: false,
    },
    {
      label:
        "The price increase of Noodle B in 2019—2020 was higher than the price increase of Noodle B from 2017—2019",
      value: false,
    },
    {
      label:
        "There is a Noodle product that experienced only one price decrease",
      value: true,
    },
    {
      label:
        "Almost all Instant Noodle products frequently experience price increases",
      value: false,
    },
    {
      label: "The price of Noodle A did not experience a drastic decrease",
      value: false,
    },
  ],
};

export default choices;
