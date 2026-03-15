import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$0.00033$$", value: false },
    { label: "$$0.00067$$", value: false },
    { label: "$$0.0033$$", value: false },
    { label: "$$0.0067$$", value: true },
    { label: "$$0.033$$", value: false },
  ],
  en: [
    { label: "$$0.00033$$", value: false },
    { label: "$$0.00067$$", value: false },
    { label: "$$0.0033$$", value: false },
    { label: "$$0.0067$$", value: true },
    { label: "$$0.033$$", value: false },
  ],
};

export default choices;
