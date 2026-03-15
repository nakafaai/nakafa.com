import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Anak memiliki sedikit lemak, banyak vitamin B6", value: false },
    { label: "Sebagian anak memiliki sedikit lemak", value: false },
    {
      label: "Anak harus mengonsumsi daging agar mendapatkan banyak lemak",
      value: false,
    },
    { label: "Anak tidak akan mendapatkan lemak", value: true },
    { label: "Ada anak yang mendapatkan banyak vitamin B6", value: false },
  ],
  en: [
    { label: "The child has little fat, a lot of vitamin B6", value: false },
    { label: "Some children have little fat", value: false },
    {
      label: "Children must consume meat to get a lot of fat",
      value: false,
    },
    { label: "The child will not get any fat", value: true },
    { label: "There are children who get a lot of vitamin B6", value: false },
  ],
};

export default choices;
