import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "ketidakjelasan.",
      value: true,
    },
    {
      label: "kepastian.",
      value: false,
    },
    {
      label: "ketepatwaktuan.",
      value: false,
    },
    {
      label: "keanekaragaman.",
      value: false,
    },
    {
      label: "keseragaman.",
      value: false,
    },
  ],
  en: [
    {
      label: "unclarity.",
      value: true,
    },
    {
      label: "certainty.",
      value: false,
    },
    {
      label: "timeliness.",
      value: false,
    },
    {
      label: "diversity.",
      value: false,
    },
    {
      label: "uniformity.",
      value: false,
    },
  ],
};

export default choices;
