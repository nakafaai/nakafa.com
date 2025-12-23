import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$P > Q$$", value: false },
    { label: "$$P < Q$$", value: false },
    { label: "$$P = Q$$", value: true },
    { label: "$$P + Q = 12x$$", value: false },
    {
      label:
        "Informasi yang diberikan tidak cukup untuk memutuskan salah satu dari keempat pilihan di atas",
      value: false,
    },
  ],
  en: [
    { label: "$$P > Q$$", value: false },
    { label: "$$P < Q$$", value: false },
    { label: "$$P = Q$$", value: true },
    { label: "$$P + Q = 12x$$", value: false },
    {
      label:
        "The information provided is not sufficient to decide on one of the four choices above",
      value: false,
    },
  ],
};

export default choices;
