import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Keseimbangan suhu pendaki.",
      value: false,
    },
    {
      label: "Kekhawatiran para pendaki.",
      value: false,
    },
    {
      label: "Hipotermia dapat mematikan.",
      value: true,
    },
    {
      label: "Suhu pendaki di bawah normal.",
      value: false,
    },
    {
      label: "Larangan memakai baju ketat.",
      value: false,
    },
  ],
  en: [
    {
      label: "Climbers' temperature balance.",
      value: false,
    },
    {
      label: "The climbers' worries.",
      value: false,
    },
    {
      label: "Hypothermia can be deadly.",
      value: true,
    },
    {
      label: "Climbers' temperature below normal.",
      value: false,
    },
    {
      label: "Prohibition of wearing tight clothes.",
      value: false,
    },
  ],
};

export default choices;
