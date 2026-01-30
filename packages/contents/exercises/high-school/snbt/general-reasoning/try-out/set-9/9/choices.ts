import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Kelas A", value: false },
    { label: "Kelas B", value: false },
    { label: "Kelas C", value: true },
    { label: "Kelas D", value: false },
    { label: "Kelas E", value: false },
  ],
  en: [
    { label: "Class A", value: false },
    { label: "Class B", value: false },
    { label: "Class C", value: true },
    { label: "Class D", value: false },
    { label: "Class E", value: false },
  ],
};

export default choices;
