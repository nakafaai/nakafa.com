import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$P > Q$$", value: true },
    { label: "$$P < Q$$", value: false },
    { label: "$$P = Q$$", value: false },
    { label: "$$P + Q = 1$$", value: false },
    {
      label:
        "Informasi yang diberikan tidak cukup untuk memutuskan salah satu pilihan.",
      value: false,
    },
  ],
  en: [
    { label: "$$P > Q$$", value: true },
    { label: "$$P < Q$$", value: false },
    { label: "$$P = Q$$", value: false },
    { label: "$$P + Q = 1$$", value: false },
    {
      label:
        "The information provided is not sufficient to decide one of the options.",
      value: false,
    },
  ],
};

export default choices;
