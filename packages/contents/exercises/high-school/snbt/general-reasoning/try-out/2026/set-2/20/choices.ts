import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Pertumbuhan pasar ekspor pakaian jadi Indonesia naik 9,3%.",
      value: false,
    },
    {
      label: "Jepang merupakan pasar utama produk pakaian jadi Indonesia.",
      value: false,
    },
    {
      label:
        "Pasar utama produk pakaian jadi Indonesia adalah Amerika Serikat.",
      value: true,
    },
    {
      label:
        "Amerika Serikat dan Jerman merupakan dua negara dengan nilai ekspor tertinggi.",
      value: false,
    },
    {
      label:
        "Nilai ekspor pakaian jadi Indonesia ke Amerika Serikat lebih sedikit daripada tahun lalu.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "The growth of Indonesia's ready-made clothing export market increased by 9.3%.",
      value: false,
    },
    {
      label:
        "Japan is the main market for Indonesia's ready-made clothing products.",
      value: false,
    },
    {
      label:
        "The main market for Indonesia's ready-made clothing products is the United States.",
      value: true,
    },
    {
      label:
        "The United States and Germany are the two countries with the highest export values.",
      value: false,
    },
    {
      label:
        "The export value of Indonesia's ready-made clothing to the United States is less than last year.",
      value: false,
    },
  ],
};

export default choices;
