import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Handphone mungkin tidak memberi dampak negatif bagi perkembangan anak.",
      value: false,
    },
    {
      label: "Hubungan komunikasi anak dan orangtua akan terjalin dengan baik.",
      value: false,
    },
    {
      label: "Handphone akan menyebabkan terganggunya pertumbuhan otak anak.",
      value: true,
    },
    {
      label: "Handphone akan memberikan banyak sekali kerugian bagi keluarga.",
      value: false,
    },
    {
      label: "Pertumbuhan otak anak akan semakin baik.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Mobile phones might not have a negative impact on child development.",
      value: false,
    },
    {
      label:
        "Communication relationship between child and parents will be well established.",
      value: false,
    },
    {
      label: "Mobile phones will cause disruption to the child's brain growth.",
      value: true,
    },
    {
      label: "Mobile phones will cause a lot of harm to the family.",
      value: false,
    },
    {
      label: "The child's brain growth will get better.",
      value: false,
    },
  ],
};

export default choices;
