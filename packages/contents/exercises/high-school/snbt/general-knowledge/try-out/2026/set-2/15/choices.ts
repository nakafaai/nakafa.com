import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Ruangan itu sudah dibersihkan sejak kemarin.",
      value: false,
    },
    {
      label: "Tulisan itu akan segera diterbitkan.",
      value: true,
    },
    {
      label: "Tarian dari Jawa Barat sangat beragam.",
      value: false,
    },
    {
      label: "Dia mendengar panggilan dari arah belakang.",
      value: false,
    },
    {
      label: "Dia mendapat banyak pujian atas karyanya yang baru diluncurkan.",
      value: false,
    },
  ],
  en: [
    {
      label: "The room has been cleaned since yesterday.",
      value: false,
    },
    {
      label: "The writing will be published soon.",
      value: true,
    },
    {
      label: "Dances from West Java are very diverse.",
      value: false,
    },
    {
      label: "He heard a call from behind.",
      value: false,
    },
    {
      label: "He received a lot of praise for his newly launched work.",
      value: false,
    },
  ],
};

export default choices;
