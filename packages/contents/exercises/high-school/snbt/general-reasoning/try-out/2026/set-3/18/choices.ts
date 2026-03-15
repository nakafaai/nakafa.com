import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Semua orang mengkonsumsi teh dengan tambahan gula.",
      value: false,
    },
    {
      label:
        "Semua anak di bawah 5 tahun mengkonsumsi teh dengan tambahan gula.",
      value: false,
    },
    {
      label:
        "Beberapa anak di bawah 5 tahun mengkonsumsi teh dengan tambahan gula.",
      value: false,
    },
    {
      label: "Beberapa orang mengkonsumsi teh tanpa tambahan gula.",
      value: true,
    },
    { label: "Semua orang yang menambahkan gula meminum teh.", value: false },
  ],
  en: [
    { label: "All people consume tea with added sugar.", value: false },
    {
      label: "All children under 5 years old consume tea with added sugar.",
      value: false,
    },
    {
      label: "Some children under 5 years old consume tea with added sugar.",
      value: false,
    },
    { label: "Some people consume tea without added sugar.", value: true },
    { label: "All people who add sugar drink tea.", value: false },
  ],
};

export default choices;
