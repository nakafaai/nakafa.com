import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$(1), (2), \\text{ dan } (3)$$",
      value: false,
    },
    {
      label: "$$(1) \\text{ dan } (3)$$",
      value: true,
    },
    {
      label: "$$(2) \\text{ dan } (4)$$",
      value: false,
    },
    {
      label: "$$(4)$$",
      value: false,
    },
    {
      label: "$$(1), (2), (3), \\text{ dan } (4)$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$(1), (2), \\text{ and } (3)$$",
      value: false,
    },
    {
      label: "$$(1) \\text{ and } (3)$$",
      value: true,
    },
    {
      label: "$$(2) \\text{ and } (4)$$",
      value: false,
    },
    {
      label: "$$(4)$$",
      value: false,
    },
    {
      label: "$$(1), (2), (3), \\text{ and } (4)$$",
      value: false,
    },
  ],
};

export default choices;
