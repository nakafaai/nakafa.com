import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

// Date: 11/22/2025
const choices: ExercisesChoices = {
  id: [
    {
      label: "$$P > Q$$",
      value: false,
    },
    {
      label: "$$Q > P$$",
      value: true,
    },
    {
      label: "$$P = Q$$",
      value: false,
    },
    {
      label: "$$P = 2Q$$",
      value: false,
    },
    {
      label:
        "Informasi yang diberikan tidak cukup untuk memutuskan salah satu dari tiga pilihan di atas",
      value: false,
    },
  ],
  en: [
    {
      label: "$$P > Q$$",
      value: false,
    },
    {
      label: "$$Q > P$$",
      value: true,
    },
    {
      label: "$$P = Q$$",
      value: false,
    },
    {
      label: "$$P = 2Q$$",
      value: false,
    },
    {
      label:
        "The information provided is not sufficient to decide one of the three options above",
      value: false,
    },
  ],
};

export default choices;
