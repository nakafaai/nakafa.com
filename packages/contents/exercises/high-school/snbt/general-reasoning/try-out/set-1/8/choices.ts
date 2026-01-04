import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Rp40.000.000.000,00", value: false },
    { label: "Rp50.000.000.000,00", value: false },
    { label: "Rp60.000.000.000,00", value: false },
    { label: "Rp70.000.000.000,00", value: true },
    { label: "Rp80.000.000.000,00", value: false },
  ],
  en: [
    { label: "Rp40,000,000,000.00", value: false },
    { label: "Rp50,000,000,000.00", value: false },
    { label: "Rp60,000,000,000.00", value: false },
    { label: "Rp70,000,000,000.00", value: true },
    { label: "Rp80,000,000,000.00", value: false },
  ],
};

export default choices;
