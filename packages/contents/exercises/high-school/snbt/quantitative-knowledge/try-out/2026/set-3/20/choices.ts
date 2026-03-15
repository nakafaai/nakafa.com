import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$P > Q$$",
      value: false,
    },
    {
      label: "$$P < Q$$",
      value: false,
    },
    {
      label: "$$P = Q$$",
      value: false,
    },
    {
      label:
        "Informasi yang diberikan tidak cukup untuk memutuskan salah satu dari tiga pilihan di atas",
      value: true,
    },
    {
      label: "$$P = 2Q$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$P > Q$$",
      value: false,
    },
    {
      label: "$$P < Q$$",
      value: false,
    },
    {
      label: "$$P = Q$$",
      value: false,
    },
    {
      label:
        "The information provided is not sufficient to decide on one of the three options above",
      value: true,
    },
    {
      label: "$$P = 2Q$$",
      value: false,
    },
  ],
};

export default choices;
