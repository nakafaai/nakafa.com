import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Semua roti dari pabrik X mengandung karbohidrat atau energi",
      value: false,
    },
    {
      label:
        "Semua roti dari pabrik X terbuat dari tepung terigu protein tinggi",
      value: false,
    },
    {
      label:
        "Ada roti dari pabrik X terbuat dari protein tinggi tanpa mengandung karbohidrat",
      value: false,
    },
    {
      label: "Tidak ada roti yang terbuat dari tepung terigu protein tinggi",
      value: false,
    },
    {
      label: "Ada roti dari pabrik X terbuat dari tepung terigu protein rendah",
      value: true,
    },
  ],
  en: [
    {
      label: "All bread from factory X contains carbohydrates or energy",
      value: false,
    },
    {
      label: "All bread from factory X is made from high-protein wheat flour",
      value: false,
    },
    {
      label:
        "Some bread from factory X is made from high-protein flour without containing carbohydrates",
      value: false,
    },
    { label: "No bread is made from high-protein wheat flour", value: false },
    {
      label: "Some bread from factory X is made from low-protein wheat flour",
      value: true,
    },
  ],
};

export default choices;
