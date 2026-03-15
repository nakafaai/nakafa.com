import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$1 : \\sqrt[3]{2}$$", value: true },
    { label: "$$\\sqrt[3]{2} : 1$$", value: false },
    { label: "$$1 : \\sqrt{2}$$", value: false },
    { label: "$$\\sqrt{2} : 1$$", value: false },
    { label: "$$1 : \\sqrt{3}$$", value: false },
  ],
  en: [
    { label: "$$1 : \\sqrt[3]{2}$$", value: true },
    { label: "$$\\sqrt[3]{2} : 1$$", value: false },
    { label: "$$1 : \\sqrt{2}$$", value: false },
    { label: "$$\\sqrt{2} : 1$$", value: false },
    { label: "$$1 : \\sqrt{3}$$", value: false },
  ],
};

export default choices;
