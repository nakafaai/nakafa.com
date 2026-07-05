import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    {
      label: "$$\\frac{1}{2^{11}}$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2^{12}}$$",
      value: false,
    },
    {
      label: "$$\\frac{3}{2^{11}}$$",
      value: false,
    },
    {
      label: "$$\\frac{3}{2^{12}}$$",
      value: true,
    },
    {
      label: "$$\\frac{1}{2^{11}} + \\frac{1}{3^{11}}$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\frac{1}{2^{11}}$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2^{12}}$$",
      value: false,
    },
    {
      label: "$$\\frac{3}{2^{11}}$$",
      value: false,
    },
    {
      label: "$$\\frac{3}{2^{12}}$$",
      value: true,
    },
    {
      label: "$$\\frac{1}{2^{11}} + \\frac{1}{3^{11}}$$",
      value: false,
    },
  ],
};

export default choices;
