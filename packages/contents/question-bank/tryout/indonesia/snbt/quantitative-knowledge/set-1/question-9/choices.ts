import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    {
      label: "$$\\text{I, II, dan III}$$",
      value: false,
    },
    {
      label: "$$\\text{I dan II}$$",
      value: true,
    },
    {
      label: "$$\\text{II dan III}$$",
      value: false,
    },
    {
      label: "$$\\text{I}$$",
      value: false,
    },
    {
      label: "$$\\text{III}$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\text{I, II, and III}$$",
      value: false,
    },
    {
      label: "$$\\text{I and II}$$",
      value: true,
    },
    {
      label: "$$\\text{II and III}$$",
      value: false,
    },
    {
      label: "$$\\text{I}$$",
      value: false,
    },
    {
      label: "$$\\text{III}$$",
      value: false,
    },
  ],
};

export default choices;
