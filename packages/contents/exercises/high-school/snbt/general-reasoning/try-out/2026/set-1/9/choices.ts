import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "1 jam", value: false },
    { label: "1 jam 30 menit", value: false },
    { label: "2 jam", value: false },
    { label: "2 jam 30 menit", value: false },
    { label: "3 jam", value: true },
  ],
  en: [
    { label: "1 hour", value: false },
    { label: "1 hour 30 minutes", value: false },
    { label: "2 hours", value: false },
    { label: "2 hours 30 minutes", value: false },
    { label: "3 hours", value: true },
  ],
};

export default choices;
