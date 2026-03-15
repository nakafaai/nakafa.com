import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$x < -2$$",
      value: false,
    },
    {
      label: "$$-5 < x < -2$$",
      value: true,
    },
    {
      label: "$$x > -5$$",
      value: false,
    },
    {
      label: "$$-5 < x < 1$$",
      value: false,
    },
    {
      label: "$$x > 1$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$x < -2$$",
      value: false,
    },
    {
      label: "$$-5 < x < -2$$",
      value: true,
    },
    {
      label: "$$x > -5$$",
      value: false,
    },
    {
      label: "$$-5 < x < 1$$",
      value: false,
    },
    {
      label: "$$x > 1$$",
      value: false,
    },
  ],
};

export default choices;
