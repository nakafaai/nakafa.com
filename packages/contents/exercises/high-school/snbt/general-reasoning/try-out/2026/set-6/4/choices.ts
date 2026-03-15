import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "memperlambat proses pencernaan",
      value: true,
    },
    {
      label: "menghambat gejala stroke",
      value: false,
    },
    {
      label: "mengalami penyakit ginjal dengan durasi yang lama",
      value: false,
    },
    {
      label: "mengurangi nafsu makan",
      value: false,
    },
    {
      label: "menyebabkan makanan tidak tercerna oleh tubuh",
      value: false,
    },
  ],
  en: [
    {
      label: "slows down the digestion process",
      value: true,
    },
    {
      label: "inhibits stroke symptoms",
      value: false,
    },
    {
      label: "causes prolonged kidney disease",
      value: false,
    },
    {
      label: "reduces appetite",
      value: false,
    },
    {
      label: "causes food to be undigested by the body",
      value: false,
    },
  ],
};

export default choices;
