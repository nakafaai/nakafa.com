import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Sebagian kesehatan anak dapat dilihat dari keberadaan gizi yang ditunjukkan oleh berat badan",
      value: false,
    },
    {
      label:
        "Semua indikator berat badan dan tinggi anak adalah indikator kecukupan gizi anak",
      value: false,
    },
    {
      label:
        "Sebagian gizi yang dibutuhkan anak dapat berperan untuk peningkatan berat badan dan tinggi anak",
      value: false,
    },
    {
      label:
        "Semua indikator kesehatan anak dapat dilihat dari kecukupan gizi dengan memperhatikan berat badan dan tinggi badan",
      value: true,
    },
    {
      label:
        "Sebagian indikator kecukupan gizi berfungsi mengontrol berat badan anak",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Part of a child's health can be seen from the presence of nutrition indicated by body weight",
      value: false,
    },
    {
      label:
        "All indicators of a child's weight and height are indicators of the child's nutritional adequacy",
      value: false,
    },
    {
      label:
        "Part of the nutrition needed by children can play a role in increasing the child's weight and height",
      value: false,
    },
    {
      label:
        "All indicators of a child's health can be seen from nutritional adequacy by observing body weight and height",
      value: true,
    },
    {
      label:
        "Part of the nutritional adequacy indicators function to control the child's body weight",
      value: false,
    },
  ],
};

export default choices;
