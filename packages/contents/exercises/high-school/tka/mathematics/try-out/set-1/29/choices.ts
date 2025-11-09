import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$y = 2x + 6$$",
      value: false,
    },
    {
      label: "$$y = 2x - 6$$",
      value: false,
    },
    {
      label: "$$y = x + 12$$",
      value: false,
    },
    {
      label: "$$y = x + 9$$",
      value: true,
    },
    {
      label: "$$y = x - 9$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$y = 2x + 6$$",
      value: false,
    },
    {
      label: "$$y = 2x - 6$$",
      value: false,
    },
    {
      label: "$$y = x + 12$$",
      value: false,
    },
    {
      label: "$$y = x + 9$$",
      value: true,
    },
    {
      label: "$$y = x - 9$$",
      value: false,
    },
  ],
};

export default choices;
