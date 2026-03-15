import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$7\\pi\\text{ cm}$$", value: false },
    { label: "$$10\\pi\\text{ cm}$$", value: false },
    { label: "$$12\\pi\\text{ cm}$$", value: false },
    { label: "$$14\\pi\\text{ cm}$$", value: false },
    { label: "$$16\\pi\\text{ cm}$$", value: true },
  ],
  en: [
    { label: "$$7\\pi\\text{ cm}$$", value: false },
    { label: "$$10\\pi\\text{ cm}$$", value: false },
    { label: "$$12\\pi\\text{ cm}$$", value: false },
    { label: "$$14\\pi\\text{ cm}$$", value: false },
    { label: "$$16\\pi\\text{ cm}$$", value: true },
  ],
};

export default choices;
