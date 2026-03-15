import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$-1$$",
      value: false,
    },
    {
      label: "$$1$$",
      value: false,
    },
    {
      label: "$$0$$",
      value: false,
    },
    {
      label: "$$y$$",
      value: true,
    },
    {
      label: "$$-y$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$-1$$",
      value: false,
    },
    {
      label: "$$1$$",
      value: false,
    },
    {
      label: "$$0$$",
      value: false,
    },
    {
      label: "$$y$$",
      value: true,
    },
    {
      label: "$$-y$$",
      value: false,
    },
  ],
};

export default choices;
