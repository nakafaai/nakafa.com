import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    {
      label: "$$m < -2 \\text{ atau } m > -1$$",
      value: false,
    },
    {
      label: "$$-2 < m < -1$$",
      value: false,
    },
    {
      label: "$$-2 < m < -\\frac{1}{2}$$",
      value: false,
    },
    {
      label: "$$-2 < m \\leq -\\frac{7}{16}$$",
      value: false,
    },
    {
      label: "$$-1 < m \\leq -\\frac{7}{16}$$",
      value: true,
    },
  ],
  en: [
    {
      label: "$$m < -2 \\text{ or } m > -1$$",
      value: false,
    },
    {
      label: "$$-2 < m < -1$$",
      value: false,
    },
    {
      label: "$$-2 < m < -\\frac{1}{2}$$",
      value: false,
    },
    {
      label: "$$-2 < m \\leq -\\frac{7}{16}$$",
      value: false,
    },
    {
      label: "$$-1 < m \\leq -\\frac{7}{16}$$",
      value: true,
    },
  ],
};

export default choices;
