import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "penetration", value: false },
    { label: "connection", value: false },
    { label: "presence", value: true },
    { label: "benefit", value: false },
    { label: "device", value: false },
  ],
  en: [
    { label: "penetration", value: false },
    { label: "connection", value: false },
    { label: "presence", value: true },
    { label: "benefit", value: false },
    { label: "device", value: false },
  ],
};

export default choices;
