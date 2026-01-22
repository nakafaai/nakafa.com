import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Oktober", value: false },
    { label: "November", value: false },
    { label: "Desember", value: true },
    { label: "Januari", value: false },
    { label: "Februari", value: false },
  ],
  en: [
    { label: "October", value: false },
    { label: "November", value: false },
    { label: "December", value: true },
    { label: "January", value: false },
    { label: "February", value: false },
  ],
};

export default choices;
