import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

// Date: 11/23/2025
const choices: ExercisesChoices = {
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
