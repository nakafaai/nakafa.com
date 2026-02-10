import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Mengonsumsi makanan yang mengandung lemak berlebih akan meningkatkan energi di siang hari.",
      value: false,
    },
    {
      label:
        "Penambahan berat badan karena lemak berdampak baik bagi Kesehatan tubuh.",
      value: false,
    },
    {
      label:
        "Kelebihan kalori akibat lemak dapat berdampak pada tubuh yang sulit untuk bergerak aktif.",
      value: true,
    },
    {
      label:
        "Lesu di siang hari selalu disebabkan oleh konsumsi makanan tinggi lemak.",
      value: false,
    },
    {
      label:
        "Mengonsumsi makanan lemak yang cukup akan membuat tubuh sulit untuk bergerak aktif.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Consuming food containing excess fat will increase energy during the day.",
      value: false,
    },
    {
      label: "Weight gain due to fat has a good impact on body health.",
      value: false,
    },
    {
      label:
        "Excess calories due to fat can result in the body being difficult to move actively.",
      value: true,
    },
    {
      label:
        "Lethargy during the day is always caused by consuming high-fat foods.",
      value: false,
    },
    {
      label:
        "Consuming enough fatty foods will make the body difficult to move actively.",
      value: false,
    },
  ],
};

export default choices;
