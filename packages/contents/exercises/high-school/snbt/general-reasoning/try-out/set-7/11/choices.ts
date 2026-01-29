import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$150\\text{ gram}$$", value: false },
    { label: "$$175\\text{ gram}$$", value: false },
    { label: "$$225\\text{ gram}$$", value: true },
    { label: "$$250\\text{ gram}$$", value: false },
    { label: "$$275\\text{ gram}$$", value: false },
  ],
  en: [
    { label: "$$150\\text{ grams}$$", value: false },
    { label: "$$175\\text{ grams}$$", value: false },
    { label: "$$225\\text{ grams}$$", value: true },
    { label: "$$250\\text{ grams}$$", value: false },
    { label: "$$275\\text{ grams}$$", value: false },
  ],
};

export default choices;
