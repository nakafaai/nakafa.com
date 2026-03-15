import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "72 jam", value: false },
    { label: "132 jam", value: false },
    { label: "144 jam", value: true },
    { label: "240 jam", value: false },
    { label: "360 jam", value: false },
  ],
  en: [
    { label: "72 hours", value: false },
    { label: "132 hours", value: false },
    { label: "144 hours", value: true },
    { label: "240 hours", value: false },
    { label: "360 hours", value: false },
  ],
};

export default choices;
