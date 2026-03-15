import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "6 menit", value: false },
    { label: "7 menit", value: false },
    { label: "8 menit", value: true },
    { label: "9 menit", value: false },
    { label: "10 menit", value: false },
  ],
  en: [
    { label: "6 minutes", value: false },
    { label: "7 minutes", value: false },
    { label: "8 minutes", value: true },
    { label: "9 minutes", value: false },
    { label: "10 minutes", value: false },
  ],
};

export default choices;
