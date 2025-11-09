import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$2\\cos 2x - 3\\sin x + C$$",
      value: false,
    },
    {
      label: "$$-2\\cos 2x + 3\\sin x + C$$",
      value: false,
    },
    {
      label: "$$-2\\cos 2x - 3\\sin x + C$$",
      value: false,
    },
    {
      label: "$$-\\cos 2x - 3\\sin x + C$$",
      value: true,
    },
    {
      label: "$$\\cos 2x + 3\\sin x + C$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$2\\cos 2x - 3\\sin x + C$$",
      value: false,
    },
    {
      label: "$$-2\\cos 2x + 3\\sin x + C$$",
      value: false,
    },
    {
      label: "$$-2\\cos 2x - 3\\sin x + C$$",
      value: false,
    },
    {
      label: "$$-\\cos 2x - 3\\sin x + C$$",
      value: true,
    },
    {
      label: "$$\\cos 2x + 3\\sin x + C$$",
      value: false,
    },
  ],
};

export default choices;

