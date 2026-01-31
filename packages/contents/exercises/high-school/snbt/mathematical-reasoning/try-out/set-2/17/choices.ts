import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$1\\frac{1}{2}\\text{ kg}$$", value: false },
    { label: "$$2\\text{ kg}$$", value: false },
    { label: "$$4\\text{ kg}$$", value: false },
    { label: "$$6\\text{ kg}$$", value: true },
    { label: "$$8\\text{ kg}$$", value: false },
  ],
  en: [
    { label: "$$1\\frac{1}{2}\\text{ kg}$$", value: false },
    { label: "$$2\\text{ kg}$$", value: false },
    { label: "$$4\\text{ kg}$$", value: false },
    { label: "$$6\\text{ kg}$$", value: true },
    { label: "$$8\\text{ kg}$$", value: false },
  ],
};

export default choices;
