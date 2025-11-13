import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
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
