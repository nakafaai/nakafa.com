import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$y = -x + 1$$",
      value: false,
    },
    {
      label: "$$y = x + 1$$",
      value: true,
    },
    {
      label: "$$y = 2x - 1$$",
      value: false,
    },
    {
      label: "$$y = 2x + 1$$",
      value: false,
    },
    {
      label: "$$y = 2x + 2$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$y = -x + 1$$",
      value: false,
    },
    {
      label: "$$y = x + 1$$",
      value: true,
    },
    {
      label: "$$y = 2x - 1$$",
      value: false,
    },
    {
      label: "$$y = 2x + 1$$",
      value: false,
    },
    {
      label: "$$y = 2x + 2$$",
      value: false,
    },
  ],
};

export default choices;
