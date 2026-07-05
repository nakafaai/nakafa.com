import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

// Date: 2025-11-23
const choices: QuestionChoices = {
  id: [
    {
      label: "$$\\{x \\mid x < 5, x \\in \\mathbb{R}\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\mid x > \\frac{5}{4}, x \\in \\mathbb{R}\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\mid \\frac{5}{4} < x < 5, x \\in \\mathbb{R}\\}$$",
      value: true,
    },
    {
      label: "$$\\{x \\mid x < 15, x \\in \\mathbb{R}\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\mid 5 < x < 15, x \\in \\mathbb{R}\\}$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\{x \\mid x < 5, x \\in \\mathbb{R}\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\mid x > \\frac{5}{4}, x \\in \\mathbb{R}\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\mid \\frac{5}{4} < x < 5, x \\in \\mathbb{R}\\}$$",
      value: true,
    },
    {
      label: "$$\\{x \\mid x < 15, x \\in \\mathbb{R}\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\mid 5 < x < 15, x \\in \\mathbb{R}\\}$$",
      value: false,
    },
  ],
};

export default choices;
