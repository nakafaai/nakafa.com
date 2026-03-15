import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$14 \\text{ dan } 2$$", value: false },
    { label: "$$12 \\text{ dan } 2$$", value: false },
    { label: "$$8 \\text{ dan } 2$$", value: false },
    { label: "$$4 \\text{ dan } 2$$", value: true },
    { label: "$$2 \\text{ dan } 2$$", value: false },
  ],
  en: [
    { label: "$$14 \\text{ and } 2$$", value: false },
    { label: "$$12 \\text{ and } 2$$", value: false },
    { label: "$$8 \\text{ and } 2$$", value: false },
    { label: "$$4 \\text{ and } 2$$", value: true },
    { label: "$$2 \\text{ and } 2$$", value: false },
  ],
};

export default choices;
