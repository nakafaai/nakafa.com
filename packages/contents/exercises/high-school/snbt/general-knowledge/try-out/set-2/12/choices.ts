import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Anak menikmati aktivitas di luar ruangan.",
      value: false,
    },
    {
      label: "Anak lebih bahagia.",
      value: false,
    },
    {
      label: "Musim panas membuat anak-anak bahagia.",
      value: true,
    },
    {
      label: "Musim panas menikmati aktivitas luar.",
      value: false,
    },
    {
      label: "Anak-anak beraktivitas di luar.",
      value: false,
    },
  ],
  en: [
    {
      label: "Children enjoy outdoor activities.",
      value: false,
    },
    {
      label: "Children are happier.",
      value: false,
    },
    {
      label: "Summer makes children happy.",
      value: true,
    },
    {
      label: "Summer enjoys outdoor activities.",
      value: false,
    },
    {
      label: "Children do activities outside.",
      value: false,
    },
  ],
};

export default choices;
