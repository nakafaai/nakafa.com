import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$6\\text{ menit}$$", value: false },
    { label: "$$7\\text{ menit}$$", value: false },
    { label: "$$8\\text{ menit}$$", value: true },
    { label: "$$9\\text{ menit}$$", value: false },
    { label: "$$10\\text{ menit}$$", value: false },
  ],
  en: [
    { label: "$$6\\text{ minutes}$$", value: false },
    { label: "$$7\\text{ minutes}$$", value: false },
    { label: "$$8\\text{ minutes}$$", value: true },
    { label: "$$9\\text{ minutes}$$", value: false },
    { label: "$$10\\text{ minutes}$$", value: false },
  ],
};

export default choices;
