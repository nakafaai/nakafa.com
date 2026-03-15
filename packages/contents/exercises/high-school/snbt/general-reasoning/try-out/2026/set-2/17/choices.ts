import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Sains", value: false },
    { label: "Kamus", value: true },
    { label: "Agama", value: false },
    { label: "Sastra", value: false },
    { label: "Sejarah", value: false },
  ],
  en: [
    { label: "Science", value: false },
    { label: "Dictionary", value: true },
    { label: "Religion", value: false },
    { label: "Literature", value: false },
    { label: "History", value: false },
  ],
};

export default choices;
