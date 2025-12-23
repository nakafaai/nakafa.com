import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$-13x - y - 15 = 0$$", value: false },
    { label: "$$13x - y - 15 = 0$$", value: false },
    { label: "$$13x + y - 15 = 0$$", value: true },
    { label: "$$-13x + y - 15 = 0$$", value: false },
    { label: "$$13x + y - 37 = 0$$", value: false },
  ],
  en: [
    { label: "$$-13x - y - 15 = 0$$", value: false },
    { label: "$$13x - y - 15 = 0$$", value: false },
    { label: "$$13x + y - 15 = 0$$", value: true },
    { label: "$$-13x + y - 15 = 0$$", value: false },
    { label: "$$13x + y - 37 = 0$$", value: false },
  ],
};

export default choices;
