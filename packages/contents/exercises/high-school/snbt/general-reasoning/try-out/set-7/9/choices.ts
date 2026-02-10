import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Senin", value: false },
    { label: "Selasa", value: true },
    { label: "Rabu", value: false },
    { label: "Kamis", value: false },
    { label: "Jumat", value: false },
  ],
  en: [
    { label: "Monday", value: false },
    { label: "Tuesday", value: true },
    { label: "Wednesday", value: false },
    { label: "Thursday", value: false },
    { label: "Friday", value: false },
  ],
};

export default choices;
