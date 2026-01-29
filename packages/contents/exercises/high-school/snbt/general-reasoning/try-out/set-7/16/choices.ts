import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Meminimalkan kerusakan habitat satwa dapat mengurangi ancaman kepunahan satwa.",
      value: false,
    },
    {
      label:
        "Sebagian spesies tanaman di IKN terancam punah karena dampak dari pembangunan.",
      value: false,
    },
    {
      label:
        "Pembangunan Ibu Kota Negara (IKN) tidak mempengaruhi keberadaan satwa.",
      value: true,
    },
    {
      label:
        "Sebagian satwa terancam punah karena kerusakan habitat akibat pembangunan.",
      value: false,
    },
    {
      label:
        "Kerusakan habitat satwa mempengaruhi pembangunan Ibu Kota Negara (IKN).",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Minimizing animal habitat destruction can reduce the threat of animal extinction.",
      value: false,
    },
    {
      label:
        "Some plant species in IKN are threatened with extinction due to the impact of construction.",
      value: false,
    },
    {
      label:
        "The construction of the National Capital City (IKN) does not affect the existence of animals.",
      value: true,
    },
    {
      label:
        "Some animals are threatened with extinction due to habitat destruction caused by construction.",
      value: false,
    },
    {
      label:
        "Animal habitat destruction affects the construction of the National Capital City (IKN).",
      value: false,
    },
  ],
};

export default choices;
