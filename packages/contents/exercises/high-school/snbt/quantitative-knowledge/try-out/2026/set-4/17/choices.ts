import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Pernyataan (1) cukup.",
      value: false,
    },
    {
      label: "Pernyataan (2) cukup.",
      value: true,
    },
    {
      label: "Pernyataan (1) dan (2) cukup jika digunakan bersama-sama.",
      value: false,
    },
    {
      label: "Pernyataan (1) cukup, pernyataan (2) cukup.",
      value: false,
    },
    {
      label: "Pernyataan (1) dan (2) tidak cukup.",
      value: false,
    },
  ],
  en: [
    {
      label: "Statement (1) is sufficient.",
      value: false,
    },
    {
      label: "Statement (2) is sufficient.",
      value: true,
    },
    {
      label: "Statements (1) and (2) are sufficient if used together.",
      value: false,
    },
    {
      label: "Statement (1) is sufficient, statement (2) is sufficient.",
      value: false,
    },
    {
      label: "Statements (1) and (2) are not sufficient.",
      value: false,
    },
  ],
};

export default choices;
