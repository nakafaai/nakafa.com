import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$16(\\sqrt{3}-1)$$", value: true },
    { label: "$$16(\\sqrt{2}-1)$$", value: false },
    { label: "$$16$$", value: false },
    { label: "$$16\\sqrt{3}$$", value: false },
    { label: "$$32\\sqrt{3}$$", value: false },
  ],
  en: [
    { label: "$$16(\\sqrt{3}-1)$$", value: true },
    { label: "$$16(\\sqrt{2}-1)$$", value: false },
    { label: "$$16$$", value: false },
    { label: "$$16\\sqrt{3}$$", value: false },
    { label: "$$32\\sqrt{3}$$", value: false },
  ],
};

export default choices;
