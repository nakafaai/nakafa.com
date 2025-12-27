import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$x < y$$", value: false },
    { label: "$$x > y$$", value: true },
    { label: "$$x = y$$", value: false },
    { label: "$$x = -y$$", value: false },
    { label: "$$x + y = 1$$", value: false },
  ],
  en: [
    { label: "$$x < y$$", value: false },
    { label: "$$x > y$$", value: true },
    { label: "$$x = y$$", value: false },
    { label: "$$x = -y$$", value: false },
    { label: "$$x + y = 1$$", value: false },
  ],
};

export default choices;
