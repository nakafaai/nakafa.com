import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

// Date: 11/22/2025
const choices: ExercisesChoices = {
  id: [
    {
      label: "Benar, Benar, Benar",
      value: false,
    },
    {
      label: "Benar, Benar, Salah",
      value: true,
    },
    {
      label: "Benar, Salah, Salah",
      value: false,
    },
    {
      label: "Salah, Benar, Benar",
      value: false,
    },
    {
      label: "Salah, Salah, Benar",
      value: false,
    },
  ],
  en: [
    {
      label: "True, True, True",
      value: false,
    },
    {
      label: "True, True, False",
      value: true,
    },
    {
      label: "True, False, False",
      value: false,
    },
    {
      label: "False, True, True",
      value: false,
    },
    {
      label: "False, False, True",
      value: false,
    },
  ],
};

export default choices;
