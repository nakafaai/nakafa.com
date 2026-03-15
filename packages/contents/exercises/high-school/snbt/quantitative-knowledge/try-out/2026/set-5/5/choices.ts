import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$2x^2 + 8x - 11$$", value: true },
    { label: "$$2x^2 + 8x - 6$$", value: false },
    { label: "$$2x^2 + 8x - 9$$", value: false },
    { label: "$$2x^2 + 4x - 6$$", value: false },
    { label: "$$2x^2 + 4x - 9$$", value: false },
  ],
  en: [
    { label: "$$2x^2 + 8x - 11$$", value: true },
    { label: "$$2x^2 + 8x - 6$$", value: false },
    { label: "$$2x^2 + 8x - 9$$", value: false },
    { label: "$$2x^2 + 4x - 6$$", value: false },
    { label: "$$2x^2 + 4x - 9$$", value: false },
  ],
};

export default choices;
