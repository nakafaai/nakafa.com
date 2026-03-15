import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$y = 2x - 4$$", value: false },
    { label: "$$y = -2x - 2$$", value: false },
    { label: "$$y = -2x + 4$$", value: false },
    { label: "$$y = 2x + 12$$", value: true },
    { label: "$$y = -2x + 12$$", value: false },
  ],
  en: [
    { label: "$$y = 2x - 4$$", value: false },
    { label: "$$y = -2x - 2$$", value: false },
    { label: "$$y = -2x + 4$$", value: false },
    { label: "$$y = 2x + 12$$", value: true },
    { label: "$$y = -2x + 12$$", value: false },
  ],
};

export default choices;
