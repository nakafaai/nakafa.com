import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$90 - x$$", value: false },
    { label: "$$90 - 2x$$", value: false },
    { label: "$$180 - x$$", value: false },
    { label: "$$180 - 2x$$", value: true },
    { label: "Tidak diketahui", value: false },
  ],
  en: [
    { label: "$$90 - x$$", value: false },
    { label: "$$90 - 2x$$", value: false },
    { label: "$$180 - x$$", value: false },
    { label: "$$180 - 2x$$", value: true },
    { label: "Unknown", value: false },
  ],
};

export default choices;
