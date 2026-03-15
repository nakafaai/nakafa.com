import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "gondrong berantakan.",
      value: false,
    },
    {
      label: "pipinya kasar.",
      value: false,
    },
    {
      label: "lingkaran hitam.",
      value: false,
    },
    {
      label: "tubuhnya menipis.",
      value: true,
    },
    {
      label: "bercukur.",
      value: false,
    },
  ],
  en: [
    {
      label: "long and messy.",
      value: false,
    },
    {
      label: "his cheeks were rough.",
      value: false,
    },
    {
      label: "dark circles.",
      value: false,
    },
    {
      label: "his body was thinning.",
      value: true,
    },
    {
      label: "shaving.",
      value: false,
    },
  ],
};

export default choices;
