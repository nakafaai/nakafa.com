import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$x - y = 0$$",
      value: false,
    },
    {
      label: "$$x - y - 8 = 0$$",
      value: false,
    },
    {
      label: "$$x - y + 8 = 0$$",
      value: true,
    },
    {
      label: "$$2x - y + 8 = 0$$",
      value: false,
    },
    {
      label: "$$2x - y - 8 = 0$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$x - y = 0$$",
      value: false,
    },
    {
      label: "$$x - y - 8 = 0$$",
      value: false,
    },
    {
      label: "$$x - y + 8 = 0$$",
      value: true,
    },
    {
      label: "$$2x - y + 8 = 0$$",
      value: false,
    },
    {
      label: "$$2x - y - 8 = 0$$",
      value: false,
    },
  ],
};

export default choices;
