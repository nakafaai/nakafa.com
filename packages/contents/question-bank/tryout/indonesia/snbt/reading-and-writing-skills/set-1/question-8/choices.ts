import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    {
      label: "menyaingi.",
      value: false,
    },
    {
      label: "menirukan.",
      value: false,
    },
    {
      label: "menyamai.",
      value: true,
    },
    {
      label: "meneladani.",
      value: false,
    },
    {
      label: "mencontoh.",
      value: false,
    },
  ],
  en: [
    {
      label: "rivaling.",
      value: false,
    },
    {
      label: "imitating.",
      value: false,
    },
    {
      label: "matching.",
      value: true,
    },
    {
      label: "following the example of.",
      value: false,
    },
    {
      label: "copying.",
      value: false,
    },
  ],
};

export default choices;
