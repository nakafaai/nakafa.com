import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "sembilan puluh-persen.",
      value: false,
    },
    {
      label: "$$90\\text{-}\\%$$.",
      value: false,
    },
    {
      label: "sembilanpuluh persen.",
      value: false,
    },
    {
      label: "$$90\\%$$.",
      value: true,
    },
    {
      label: "sembilan puluh 'persen'.",
      value: false,
    },
  ],
  en: [
    {
      label: "ninety-percent.",
      value: false,
    },
    {
      label: "$$90\\text{-}\\%$$.",
      value: false,
    },
    {
      label: "ninetypercent.",
      value: false,
    },
    {
      label: "$$90\\%$$.",
      value: true,
    },
    {
      label: "ninety 'percent'.",
      value: false,
    },
  ],
};

export default choices;
