import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Anak memiliki sedikit kalori dan banyak protein.",
      value: false,
    },
    {
      label: "Sebagian anak memiliki banyak kalori.",
      value: false,
    },
    {
      label: "Ada anak yang tidak mendapatkan lemak.",
      value: true,
    },
    {
      label: "Ada anak yang mendapatkan sedikit lemak.",
      value: false,
    },
    {
      label: "Beberapa anak mendapatkan sedikit kalori dan sedikit lemak.",
      value: false,
    },
  ],
  en: [
    {
      label: "The child has low calories and high protein.",
      value: false,
    },
    {
      label: "Some children have high calories.",
      value: false,
    },
    {
      label: "There are children who do not get fat.",
      value: true,
    },
    {
      label: "There are children who get low fat.",
      value: false,
    },
    {
      label: "Some children get low calories and low fat.",
      value: false,
    },
  ],
};

export default choices;
