import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\text{it}$$", value: false },
    { label: "$$\\text{pit}$$", value: false },
    { label: "$$\\text{sit}$$", value: false },
    { label: "$$\\text{nit}$$", value: true },
    { label: "tidak ada satupun", value: false },
  ],
  en: [
    { label: "$$\\text{it}$$", value: false },
    { label: "$$\\text{pit}$$", value: false },
    { label: "$$\\text{sit}$$", value: false },
    { label: "$$\\text{nit}$$", value: true },
    { label: "none of the above", value: false },
  ],
};

export default choices;
