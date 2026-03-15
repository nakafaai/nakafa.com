import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "1 jam 15 menit", value: true },
    { label: "1 jam 20 menit", value: false },
    { label: "1 jam 25 menit", value: false },
    { label: "2 jam 15 menit", value: false },
    { label: "2 jam 20 menit", value: false },
  ],
  en: [
    { label: "1 hour 15 minutes", value: true },
    { label: "1 hour 20 minutes", value: false },
    { label: "1 hour 25 minutes", value: false },
    { label: "2 hours 15 minutes", value: false },
    { label: "2 hours 20 minutes", value: false },
  ],
};

export default choices;
