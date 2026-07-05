import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "memperparah.", value: false },
    { label: "menyebabkan.", value: false },
    { label: "menumbuhkan.", value: false },
    { label: "mengurangi.", value: true },
    { label: "menghilangkan.", value: false },
  ],
  en: [
    { label: "worsen.", value: false },
    { label: "cause.", value: false },
    { label: "foster.", value: false },
    { label: "reduce.", value: true },
    { label: "eliminate.", value: false },
  ],
};

export default choices;
