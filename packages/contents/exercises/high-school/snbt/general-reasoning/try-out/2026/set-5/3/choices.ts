import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Sebagian anak stunting mengalami kekurangan gizi", value: false },
    {
      label:
        "Hanya faktor lingkungan yang berperan dalam menyebabkan perawakan pendek",
      value: false,
    },
    {
      label: "Stunting diakibatkan kelebihan gizi dalam waktu yang lama",
      value: false,
    },
    {
      label: "Sebagian besar anak stunting disebabkan oleh kekurangan gizi",
      value: true,
    },
    {
      label:
        "Sebagian anak yang mengalami stunting memiliki perawakan pendek dari usia normalnya dan memiliki keterlambatan dalam berpikir",
      value: false,
    },
  ],
  en: [
    { label: "Some stunting children experience malnutrition", value: false },
    {
      label: "Only environmental factors play a role in causing short stature",
      value: false,
    },
    {
      label: "Stunting is caused by overnutrition for a long period",
      value: false,
    },
    { label: "Most stunting children are caused by malnutrition", value: true },
    {
      label:
        "Some children who experience stunting have a shorter stature than their normal age and have cognitive delays",
      value: false,
    },
  ],
};

export default choices;
