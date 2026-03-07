import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "serangga.",
      value: false,
    },
    {
      label: "hewan kecil.",
      value: false,
    },
    {
      label: "mangsa kelelawar.",
      value: false,
    },
    {
      label: "kelelawar.",
      value: true,
    },
    {
      label: "serangga dan hewan kecil.",
      value: false,
    },
  ],
  en: [
    {
      label: "insects.",
      value: false,
    },
    {
      label: "small animals.",
      value: false,
    },
    {
      label: "bat prey.",
      value: false,
    },
    {
      label: "bats.",
      value: true,
    },
    {
      label: "insects and small animals.",
      value: false,
    },
  ],
};

export default choices;
