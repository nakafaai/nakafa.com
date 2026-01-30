import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Divisi A", value: false },
    { label: "Divisi B", value: false },
    { label: "Divisi C", value: true },
    { label: "Divisi D", value: false },
    { label: "Divisi E", value: false },
  ],
  en: [
    { label: "Division A", value: false },
    { label: "Division B", value: false },
    { label: "Division C", value: true },
    { label: "Division D", value: false },
    { label: "Division E", value: false },
  ],
};

export default choices;
