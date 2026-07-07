import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "it", value: false },
    { label: "pit", value: false },
    { label: "sit", value: false },
    { label: "nit", value: true },
    { label: "tidak ada satupun", value: false },
  ],
  en: [
    { label: "it", value: false },
    { label: "pit", value: false },
    { label: "sit", value: false },
    { label: "nit", value: true },
    { label: "none of the above", value: false },
  ],
};

export default choices;
