import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "(1), (2), dan (3) benar",
      value: false,
    },
    {
      label: "(1) dan (3) benar",
      value: false,
    },
    {
      label: "(2) dan (4) benar",
      value: true,
    },
    {
      label: "(4) saja benar",
      value: false,
    },
    {
      label: "semua benar",
      value: false,
    },
  ],
  en: [
    {
      label: "(1), (2), and (3) are correct",
      value: false,
    },
    {
      label: "(1) and (3) are correct",
      value: false,
    },
    {
      label: "(2) and (4) are correct",
      value: true,
    },
    {
      label: "(4) only is correct",
      value: false,
    },
    {
      label: "all are correct",
      value: false,
    },
  ],
};

export default choices;
