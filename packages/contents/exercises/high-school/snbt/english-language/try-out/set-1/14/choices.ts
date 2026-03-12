import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Prohibition", value: false },
    { label: "Obligation", value: true },
    { label: "Suggestion", value: false },
    { label: "Conclusion", value: false },
    { label: "Recommendation", value: false },
  ],
  en: [
    { label: "Prohibition", value: false },
    { label: "Obligation", value: true },
    { label: "Suggestion", value: false },
    { label: "Conclusion", value: false },
    { label: "Recommendation", value: false },
  ],
};

export default choices;
