import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "namun.", value: false },
    { label: "meskipun.", value: false },
    { label: "sedangkan.", value: false },
    { label: "tetapi.", value: true },
    { label: "melainkan.", value: false },
  ],
  en: [
    { label: "however.", value: false },
    { label: "although.", value: false },
    { label: "while.", value: false },
    { label: "but.", value: true },
    { label: "rather.", value: false },
  ],
};

export default choices;
