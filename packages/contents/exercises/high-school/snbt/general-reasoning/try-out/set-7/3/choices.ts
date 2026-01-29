import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Bakteri pada mulut berkembang biak.", value: false },
    { label: "Rutin menggosok gigi setiap hari.", value: true },
    { label: "Bau mulut akan semakin parah.", value: false },
    { label: "Serpihan sisa makanan tertinggal di mulut.", value: false },
    { label: "Tidak rutin menggosok gigi setiap hari.", value: false },
  ],
  en: [
    { label: "Bacteria in the mouth multiply.", value: false },
    { label: "Brush teeth regularly every day.", value: true },
    { label: "Bad breath will get worse.", value: false },
    { label: "Food debris remains in the mouth.", value: false },
    { label: "Do not brush teeth regularly every day.", value: false },
  ],
};

export default choices;
