import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Namun, sayangnya", value: false },
    { label: "Akhirnya, orang menganggap", value: false },
    { label: "Walaupun demikian, banyak orang yang beranggapan", value: false },
    { label: "Meskipun memiliki daya tarik universal", value: true },
    {
      label: "Dibalik semua itu, ada peran pemerintah secara agregat",
      value: false,
    },
  ],
  en: [
    { label: "Namun, sayangnya", value: false },
    { label: "Akhirnya, orang menganggap", value: false },
    { label: "Walaupun demikian, banyak orang yang beranggapan", value: false },
    { label: "Meskipun memiliki daya tarik universal", value: true },
    {
      label: "Dibalik semua itu, ada peran pemerintah secara agregat",
      value: false,
    },
  ],
};

export default choices;
