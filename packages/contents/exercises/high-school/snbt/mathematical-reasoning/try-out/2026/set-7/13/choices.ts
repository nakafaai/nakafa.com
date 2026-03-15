import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$1,2 \\text{ menit}$$", value: false },
    { label: "$$4,8 \\text{ menit}$$", value: false },
    { label: "$$18,8 \\text{ menit}$$", value: false },
    { label: "$$16,8 \\text{ menit}$$", value: true },
    { label: "$$14,2 \\text{ menit}$$", value: false },
  ],
  en: [
    { label: "$$1.2 \\text{ minutes}$$", value: false },
    { label: "$$4.8 \\text{ minutes}$$", value: false },
    { label: "$$18.8 \\text{ minutes}$$", value: false },
    { label: "$$16.8 \\text{ minutes}$$", value: true },
    { label: "$$14.2 \\text{ minutes}$$", value: false },
  ],
};

export default choices;
