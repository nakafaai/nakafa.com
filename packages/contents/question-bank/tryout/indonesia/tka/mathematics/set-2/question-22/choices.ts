import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    {
      label: "$$\\{x \\in R: -3 \\leq x \\leq 3\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\in R: -3 \\leq x \\leq 2\\}$$",
      value: true,
    },
    {
      label: "$$\\{x \\in R: x \\leq -3 \\text{ atau } x \\geq 2\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\in R: 0 \\leq x \\leq 2\\}$$",
      value: false,
    },
    {
      label: "$$R$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\{x \\in R: -3 \\leq x \\leq 3\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\in R: -3 \\leq x \\leq 2\\}$$",
      value: true,
    },
    {
      label: "$$\\{x \\in R: x \\leq -3 \\text{ or } x \\geq 2\\}$$",
      value: false,
    },
    {
      label: "$$\\{x \\in R: 0 \\leq x \\leq 2\\}$$",
      value: false,
    },
    {
      label: "$$R$$",
      value: false,
    },
  ],
};

export default choices;
