import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "(1), (2), (3), SAJA yang benar",
      value: false,
    },
    {
      label: "(1) dan (3) SAJA yang benar",
      value: true,
    },
    {
      label: "(2) dan (4) SAJA yang benar",
      value: false,
    },
    {
      label: "(4) SAJA yang benar",
      value: false,
    },
    {
      label: "SEMUA pernyataan benar",
      value: false,
    },
  ],
  en: [
    {
      label: "ONLY (1), (2), (3) are true",
      value: false,
    },
    {
      label: "ONLY (1) and (3) are true",
      value: true,
    },
    {
      label: "ONLY (2) and (4) are true",
      value: false,
    },
    {
      label: "ONLY (4) is true",
      value: false,
    },
    {
      label: "ALL statements are true",
      value: false,
    },
  ],
};

export default choices;
