import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "semakin tinggi produksi padi, semakin rendah impor beras",
      value: false,
    },
    {
      label:
        "impor beras tertinggi terjadi pada kondisi pengadaan beras tertinggi",
      value: false,
    },
    {
      label:
        "tingginya produksi beras seiring dengan tingginya pengadaan beras",
      value: true,
    },
    {
      label:
        "kondisi produksi beras paling tinggi justru pengadaan beras terendah",
      value: false,
    },
    {
      label:
        "impor beras terendah terjadi ketika terjadi pengadaan beras terendah",
      value: false,
    },
  ],
  en: [
    {
      label: "the higher the paddy production, the lower the rice imports",
      value: false,
    },
    {
      label:
        "the highest rice imports occurred during the highest rice procurement",
      value: false,
    },
    {
      label: "high rice production is consistent with high rice procurement",
      value: true,
    },
    {
      label:
        "the condition of highest rice production corresponds to the lowest rice procurement",
      value: false,
    },
    {
      label:
        "the lowest rice imports occurred when the lowest rice procurement occurred",
      value: false,
    },
  ],
};

export default choices;
