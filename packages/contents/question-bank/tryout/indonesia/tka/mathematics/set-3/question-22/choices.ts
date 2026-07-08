import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    {
      label: "$$x < -1$$ atau $$x > \\frac{5}{2}$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{1}{2}$$ atau $$x > 3$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{1}{2}$$ atau $$x > \\frac{5}{2}$$",
      value: true,
    },
    {
      label: "$$x < -1$$ atau $$x > 3$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{3}{2}$$ atau $$x > \\frac{5}{2}$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$x < -1$$ or $$x > \\frac{5}{2}$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{1}{2}$$ or $$x > 3$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{1}{2}$$ or $$x > \\frac{5}{2}$$",
      value: true,
    },
    {
      label: "$$x < -1$$ or $$x > 3$$",
      value: false,
    },
    {
      label: "$$x < -\\frac{3}{2}$$ or $$x > \\frac{5}{2}$$",
      value: false,
    },
  ],
};

export default choices;
