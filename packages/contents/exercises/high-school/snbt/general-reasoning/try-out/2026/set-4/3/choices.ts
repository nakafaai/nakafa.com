import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Ada masakan Jawa Barat yang memiliki rasa tidak asam dan pedas",
      value: false,
    },
    {
      label:
        "Beberapa masakan Jawa Barat memiliki rasa tidak asam dan tidak pedas",
      value: false,
    },
    {
      label: "Semua masakan Jawa Barat menggunakan sayuran mentah",
      value: false,
    },
    {
      label: "Ada masakan Jawa Barat tidak menggunakan sayuran mentah",
      value: false,
    },
    {
      label:
        "Ada masakan Jawa Barat tidak menggunakan sayuran mentah memiliki rasa asam dan pedas",
      value: true,
    },
  ],
  en: [
    {
      label: "There are West Javanese dishes that are not sour and spicy",
      value: false,
    },
    {
      label: "Some West Javanese dishes are neither sour nor spicy",
      value: false,
    },
    {
      label: "All West Javanese dishes use raw vegetables",
      value: false,
    },
    {
      label: "There are West Javanese dishes that do not use raw vegetables",
      value: false,
    },
    {
      label:
        "There are West Javanese dishes that do not use raw vegetables but have a sour and spicy taste",
      value: true,
    },
  ],
};

export default choices;
