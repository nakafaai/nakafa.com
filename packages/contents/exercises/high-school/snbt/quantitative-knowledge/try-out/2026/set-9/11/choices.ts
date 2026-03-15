import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$0,085$$", value: false },
    { label: "$$0,095$$", value: true },
    { label: "$$0,85$$", value: false },
    { label: "$$0,95$$", value: false },
    { label: "$$0,075$$", value: false },
  ],
  en: [
    { label: "$$0.085$$", value: false },
    { label: "$$0.095$$", value: true },
    { label: "$$0.85$$", value: false },
    { label: "$$0.95$$", value: false },
    { label: "$$0.075$$", value: false },
  ],
};

export default choices;
