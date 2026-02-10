import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$2\\text{ m}^2, 3\\text{ m}^2, 4\\text{ m}^2$$", value: true },
    { label: "$$3\\text{ m}^2, 2\\text{ m}^2, 4\\text{ m}^2$$", value: false },
    { label: "$$3\\text{ m}^2, 4\\text{ m}^2, 2\\text{ m}^2$$", value: false },
    { label: "$$3\\text{ m}^2, 4\\text{ m}^2, 5\\text{ m}^2$$", value: false },
    { label: "$$4\\text{ m}^2, 5\\text{ m}^2, 6\\text{ m}^2$$", value: false },
  ],
  en: [
    { label: "$$2\\text{ m}^2, 3\\text{ m}^2, 4\\text{ m}^2$$", value: true },
    { label: "$$3\\text{ m}^2, 2\\text{ m}^2, 4\\text{ m}^2$$", value: false },
    { label: "$$3\\text{ m}^2, 4\\text{ m}^2, 2\\text{ m}^2$$", value: false },
    { label: "$$3\\text{ m}^2, 4\\text{ m}^2, 5\\text{ m}^2$$", value: false },
    { label: "$$4\\text{ m}^2, 5\\text{ m}^2, 6\\text{ m}^2$$", value: false },
  ],
};

export default choices;
