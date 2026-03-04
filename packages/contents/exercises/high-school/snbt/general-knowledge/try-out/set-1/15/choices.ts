import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "fenomena embun.",
      value: false,
    },
    {
      label: "hamparan rumput.",
      value: false,
    },
    {
      label: "dataran tinggi.",
      value: true,
    },
    {
      label: "embun es.",
      value: false,
    },
    {
      label: "masih berada.",
      value: false,
    },
  ],
  en: [
    {
      label: "dew phenomenon.",
      value: false,
    },
    {
      label: "expanse of grass.",
      value: false,
    },
    {
      label: "plateau.",
      value: true,
    },
    {
      label: "frost.",
      value: false,
    },
    {
      label: "still located.",
      value: false,
    },
  ],
};

export default choices;
