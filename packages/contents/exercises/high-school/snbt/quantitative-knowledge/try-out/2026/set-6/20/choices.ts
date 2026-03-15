import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$-9x^2 + 30x + 30$$", value: false },
    { label: "$$-9x^2 + 30x - 20$$", value: true },
    { label: "$$-9x^2 - 30x - 20$$", value: false },
    { label: "$$-9x^2 + 30$$", value: false },
    { label: "$$-9x^2 - 20$$", value: false },
  ],
  en: [
    { label: "$$-9x^2 + 30x + 30$$", value: false },
    { label: "$$-9x^2 + 30x - 20$$", value: true },
    { label: "$$-9x^2 - 30x - 20$$", value: false },
    { label: "$$-9x^2 + 30$$", value: false },
    { label: "$$-9x^2 - 20$$", value: false },
  ],
};

export default choices;
