import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "Divisi A", value: false },
    { label: "Divisi B", value: false },
    { label: "Divisi C", value: false },
    { label: "Divisi D", value: true },
    { label: "Divisi E", value: false },
  ],
  en: [
    { label: "Division A", value: false },
    { label: "Division B", value: false },
    { label: "Division C", value: false },
    { label: "Division D", value: true },
    { label: "Division E", value: false },
  ],
};

export default choices;
