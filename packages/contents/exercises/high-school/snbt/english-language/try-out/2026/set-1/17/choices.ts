import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Paragraph 1", value: false },
    { label: "Paragraph 2", value: false },
    { label: "Paragraph 3", value: false },
    { label: "Paragraph 4", value: true },
    { label: "Paragraph 5", value: false },
  ],
  en: [
    { label: "Paragraph 1", value: false },
    { label: "Paragraph 2", value: false },
    { label: "Paragraph 3", value: false },
    { label: "Paragraph 4", value: true },
    { label: "Paragraph 5", value: false },
  ],
};

export default choices;
