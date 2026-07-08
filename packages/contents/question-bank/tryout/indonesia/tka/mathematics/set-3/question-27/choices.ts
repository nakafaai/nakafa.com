import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    {
      label: "$$x^2 - 5x + 5 = 0$$",
      value: false,
    },
    {
      label: "$$(x - 5)^2 = 0$$",
      value: false,
    },
    {
      label: "$$x^2 - 5^2 = 0$$",
      value: true,
    },
    {
      label: "$$(x + 5)^2 = 0$$",
      value: false,
    },
    {
      label: "$$x^2 + 5x + 5 = 0$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$x^2 - 5x + 5 = 0$$",
      value: false,
    },
    {
      label: "$$(x - 5)^2 = 0$$",
      value: false,
    },
    {
      label: "$$x^2 - 5^2 = 0$$",
      value: true,
    },
    {
      label: "$$(x + 5)^2 = 0$$",
      value: false,
    },
    {
      label: "$$x^2 + 5x + 5 = 0$$",
      value: false,
    },
  ],
};

export default choices;
