import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Buku tulis", value: false },
    { label: "Bolpoin", value: false },
    { label: "Pensil", value: true },
    { label: "Buku tulis dan Pensil", value: false },
    { label: "Semua memberikan keuntungan sama", value: false },
  ],
  en: [
    { label: "Notebooks", value: false },
    { label: "Ballpoints", value: false },
    { label: "Pencils", value: true },
    { label: "Notebooks and Pencils", value: false },
    { label: "All give equal profit", value: false },
  ],
};

export default choices;
