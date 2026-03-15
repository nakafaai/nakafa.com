import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Tawaran pertama", value: false },
    { label: "Tawaran kedua", value: true },
    { label: "Kedua tawaran sama besar", value: false },
    { label: "Tawaran pertama dua kali lebih besar", value: false },
    { label: "Tidak dapat ditentukan", value: false },
  ],
  en: [
    { label: "First offer", value: false },
    { label: "Second offer", value: true },
    { label: "Both offers are equal", value: false },
    { label: "First offer is twice as large", value: false },
    { label: "Cannot be determined", value: false },
  ],
};

export default choices;
