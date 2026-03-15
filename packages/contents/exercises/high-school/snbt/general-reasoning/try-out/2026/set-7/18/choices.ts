import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Memiliki cara berkembang biak yang tidak sama dengan unggas.",
      value: false,
    },
    { label: "Memiliki ciri-ciri yang sama dengan unggas.", value: false },
    {
      label: "Memiliki cara berkembang biak yang sama dengan unggas.",
      value: true,
    },
    { label: "Memiliki telur yang sama dengan golongan unggas.", value: false },
    { label: "Memiliki cara bertelur yang sama dengan unggas.", value: false },
  ],
  en: [
    {
      label: "Has a method of reproduction that is not the same as poultry.",
      value: false,
    },
    { label: "Has the same characteristics as poultry.", value: false },
    {
      label: "Has the same method of reproduction as poultry.",
      value: true,
    },
    { label: "Has the same eggs as the poultry group.", value: false },
    { label: "Has the same way of laying eggs as poultry.", value: false },
  ],
};

export default choices;
