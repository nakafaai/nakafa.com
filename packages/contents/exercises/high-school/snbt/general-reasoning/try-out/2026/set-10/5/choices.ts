import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "4 saja", value: false },
    { label: "1 dan 4", value: false },
    { label: "3 dan 4", value: false },
    { label: "2, 3, dan 4", value: false },
    { label: "1, 2, 3, dan 4", value: true },
  ],
  en: [
    { label: "4 only", value: false },
    { label: "1 and 4", value: false },
    { label: "3 and 4", value: false },
    { label: "2, 3, and 4", value: false },
    { label: "1, 2, 3, and 4", value: true },
  ],
};

export default choices;
