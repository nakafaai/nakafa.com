import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "pessimistic", value: false },
    { label: "assertive", value: false },
    { label: "objective", value: true },
    { label: "responsive", value: false },
    { label: "reactive", value: false },
  ],
  en: [
    { label: "pessimistic", value: false },
    { label: "assertive", value: false },
    { label: "objective", value: true },
    { label: "responsive", value: false },
    { label: "reactive", value: false },
  ],
};

export default choices;
