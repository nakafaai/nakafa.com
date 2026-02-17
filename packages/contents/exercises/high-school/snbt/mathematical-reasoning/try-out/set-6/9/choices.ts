import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$y = -x^2 + 150x + 60.000$$", value: false },
    { label: "$$y = x^2 + 150x + 60.000$$", value: true },
    { label: "$$y = -x^2 - 150x + 60.000$$", value: false },
    { label: "$$y = x^2 - 150x + 60.000$$", value: false },
    { label: "$$y = x^2 + 200x + 60.000$$", value: false },
  ],
  en: [
    { label: "$$y = -x^2 + 150x + 60,000$$", value: false },
    { label: "$$y = x^2 + 150x + 60,000$$", value: true },
    { label: "$$y = -x^2 - 150x + 60,000$$", value: false },
    { label: "$$y = x^2 - 150x + 60,000$$", value: false },
    { label: "$$y = x^2 + 200x + 60,000$$", value: false },
  ],
};

export default choices;
