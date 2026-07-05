import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    {
      label: "$$\\frac{1}{2^{11}} - \\frac{1}{3^{11}}$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2^{11}} - \\frac{2}{3^{11}}$$",
      value: false,
    },
    {
      label: "$$\\frac{3}{2^{11}} - \\frac{1}{3^{11}}$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2^{11}} + \\frac{1}{3^{11}}$$",
      value: true,
    },
    {
      label: "$$\\frac{2}{2^{11}} + \\frac{3}{3^{11}}$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\frac{1}{2^{11}} - \\frac{1}{3^{11}}$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2^{11}} - \\frac{2}{3^{11}}$$",
      value: false,
    },
    {
      label: "$$\\frac{3}{2^{11}} - \\frac{1}{3^{11}}$$",
      value: false,
    },
    {
      label: "$$\\frac{1}{2^{11}} + \\frac{1}{3^{11}}$$",
      value: true,
    },
    {
      label: "$$\\frac{2}{2^{11}} + \\frac{3}{3^{11}}$$",
      value: false,
    },
  ],
};

export default choices;
