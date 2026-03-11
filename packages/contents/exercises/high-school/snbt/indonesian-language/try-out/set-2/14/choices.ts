import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "GPS Collar", value: true },
    { label: "GMaps", value: false },
    { label: "Kompas", value: false },
    { label: "Moovit", value: false },
    { label: "Marine Navigation", value: false },
  ],
  en: [
    { label: "GPS Collar", value: true },
    { label: "GMaps", value: false },
    { label: "Compass", value: false },
    { label: "Moovit", value: false },
    { label: "Marine Navigation", value: false },
  ],
};

export default choices;
