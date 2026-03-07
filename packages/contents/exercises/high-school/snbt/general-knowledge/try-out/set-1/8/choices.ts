import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "perubahan secara dramatis.",
      value: false,
    },
    {
      label: "perkembangan yang pesat.",
      value: false,
    },
    {
      label: "perubahan secara bertahap.",
      value: true,
    },
    {
      label: "perubahan yang terjadi secara cepat.",
      value: false,
    },
    {
      label: "pertumbuhan.",
      value: false,
    },
  ],
  en: [
    {
      label: "dramatic change.",
      value: false,
    },
    {
      label: "rapid development.",
      value: false,
    },
    {
      label: "gradual change.",
      value: true,
    },
    {
      label: "change that occurs rapidly.",
      value: false,
    },
    {
      label: "growth.",
      value: false,
    },
  ],
};

export default choices;
