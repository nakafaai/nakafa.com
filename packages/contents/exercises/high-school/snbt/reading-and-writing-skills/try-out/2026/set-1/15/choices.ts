import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Pencemaran air diakibatkan aktivitas manusia.",
      value: true,
    },
    {
      label:
        "Pencemaran air di Indonesia sebagian besar diakibatkan oleh aktivitas manusia.",
      value: false,
    },
    {
      label: "Pencemaran air meninggalkan limbah.",
      value: false,
    },
    {
      label: "Pencemaran air di Indonesia meninggalkan limbah.",
      value: false,
    },
    {
      label: "Pencemaran air diakibatkan oleh aktivitas manusia.",
      value: false,
    },
  ],
  en: [
    {
      label: "Water pollution is caused by human activities.",
      value: true,
    },
    {
      label:
        "Water pollution in Indonesia is mostly caused by human activities.",
      value: false,
    },
    {
      label: "Water pollution leaves behind waste.",
      value: false,
    },
    {
      label: "Water pollution in Indonesia leaves behind waste.",
      value: false,
    },
    {
      label: "Water pollution is the result of human activities.",
      value: false,
    },
  ],
};

export default choices;
