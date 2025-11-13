import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$0° < x < 120°, 180° < x < 240°$$",
      value: true,
    },
    {
      label: "$$0° < x < 150°, 180° < x < 270°$$",
      value: false,
    },
    {
      label: "$$120° < x < 180°, 240° < x < 360°$$",
      value: false,
    },
    {
      label: "$$150° < x < 180°, 270° < x < 360°$$",
      value: false,
    },
    {
      label: "$$0° < x < 135°, 180° < x < 270°$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$0° < x < 120°, 180° < x < 240°$$",
      value: true,
    },
    {
      label: "$$0° < x < 150°, 180° < x < 270°$$",
      value: false,
    },
    {
      label: "$$120° < x < 180°, 240° < x < 360°$$",
      value: false,
    },
    {
      label: "$$150° < x < 180°, 270° < x < 360°$$",
      value: false,
    },
    {
      label: "$$0° < x < 135°, 180° < x < 270°$$",
      value: false,
    },
  ],
};

export default choices;
