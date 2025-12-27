import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$x_0 + 11$$", value: false },
    { label: "$$x_0 + 12$$", value: false },
    { label: "$$\\frac{1}{2}x_0 + 11$$", value: false },
    { label: "$$\\frac{1}{2}x_0 + 12$$", value: true },
    { label: "$$\\frac{1}{2}x_0 + 21$$", value: false },
  ],
  en: [
    { label: "$$x_0 + 11$$", value: false },
    { label: "$$x_0 + 12$$", value: false },
    { label: "$$\\frac{1}{2}x_0 + 11$$", value: false },
    { label: "$$\\frac{1}{2}x_0 + 12$$", value: true },
    { label: "$$\\frac{1}{2}x_0 + 21$$", value: false },
  ],
};

export default choices;
