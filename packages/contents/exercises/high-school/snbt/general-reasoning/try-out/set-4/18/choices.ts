import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "2 buku fiksi", value: false },
    { label: "1 buku fiksi dan 1 buku sains", value: false },
    { label: "1 buku sains dan 1 buku sejarah", value: false },
    { label: "2 buku sejarah", value: false },
    { label: "2 buku sains", value: true },
  ],
  en: [
    { label: "2 fiction books", value: false },
    { label: "1 fiction book and 1 science book", value: false },
    { label: "1 science book and 1 history book", value: false },
    { label: "2 history books", value: false },
    { label: "2 science books", value: true },
  ],
};

export default choices;
