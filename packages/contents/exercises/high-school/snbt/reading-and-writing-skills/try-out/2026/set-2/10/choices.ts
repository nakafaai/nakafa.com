import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "(2)-(4)-(3)-(5)-(1).",
      value: false,
    },
    {
      label: "(3)-(5)-(1)-(2)-(4).",
      value: false,
    },
    {
      label: "(1)-(3)-(2)-(4)-(5).",
      value: false,
    },
    {
      label: "(5)-(2)-(4)-(1)-(3).",
      value: true,
    },
    {
      label: "(4)-(1)-(5)-(3)-(2).",
      value: false,
    },
  ],
  en: [
    {
      label: "(2)-(4)-(3)-(5)-(1).",
      value: false,
    },
    {
      label: "(3)-(5)-(1)-(2)-(4).",
      value: false,
    },
    {
      label: "(1)-(3)-(2)-(4)-(5).",
      value: false,
    },
    {
      label: "(5)-(2)-(4)-(1)-(3).",
      value: true,
    },
    {
      label: "(4)-(1)-(5)-(3)-(2).",
      value: false,
    },
  ],
};

export default choices;
