import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Mencuci beras akan mengurangi jumlah beras", value: false },
    { label: "Mencuci beras akan merusak bentuk beras", value: false },
    {
      label: "Beras yang dicuci akan mengurangi cita rasa khas dari beras",
      value: false,
    },
    {
      label: "Kualitas beras yang dicuci tidak sebaik yang tidak dicuci",
      value: false,
    },
    {
      label: "Jumlah pati yang berasal dari butiran beras berkurang",
      value: true,
    },
  ],
  en: [
    { label: "Mencuci beras akan mengurangi jumlah beras", value: false },
    { label: "Mencuci beras akan merusak bentuk beras", value: false },
    {
      label: "Beras yang dicuci akan mengurangi cita rasa khas dari beras",
      value: false,
    },
    {
      label: "Kualitas beras yang dicuci tidak sebaik yang tidak dicuci",
      value: false,
    },
    {
      label: "Jumlah pati yang berasal dari butiran beras berkurang",
      value: true,
    },
  ],
};

export default choices;
