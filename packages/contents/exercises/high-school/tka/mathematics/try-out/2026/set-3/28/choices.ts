import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$a > -1 + \\sqrt{3}$$",
      value: false,
    },
    {
      label: "$$a < -1 - \\sqrt{3}$$",
      value: true,
    },
    {
      label: "$$a < 1 - \\sqrt{3}$$",
      value: false,
    },
    {
      label: "$$a > 1 + \\sqrt{3}$$",
      value: false,
    },
    {
      label: "$$a < -\\sqrt{3}$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$a > -1 + \\sqrt{3}$$",
      value: false,
    },
    {
      label: "$$a < -1 - \\sqrt{3}$$",
      value: true,
    },
    {
      label: "$$a < 1 - \\sqrt{3}$$",
      value: false,
    },
    {
      label: "$$a > 1 + \\sqrt{3}$$",
      value: false,
    },
    {
      label: "$$a < -\\sqrt{3}$$",
      value: false,
    },
  ],
};

export default choices;
