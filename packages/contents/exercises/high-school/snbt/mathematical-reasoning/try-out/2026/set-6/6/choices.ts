import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$2\\sqrt[3]{2}:1$$", value: false },
    { label: "$$\\sqrt[3]{4}:1$$", value: true },
    { label: "$$\\sqrt{2}:2$$", value: false },
    { label: "$$2:\\sqrt[3]{4}$$", value: false },
    { label: "$$2\\sqrt[3]{3}:1$$", value: false },
  ],
  en: [
    { label: "$$2\\sqrt[3]{2}:1$$", value: false },
    { label: "$$\\sqrt[3]{4}:1$$", value: true },
    { label: "$$\\sqrt{2}:2$$", value: false },
    { label: "$$2:\\sqrt[3]{4}$$", value: false },
    { label: "$$2\\sqrt[3]{3}:1$$", value: false },
  ],
};

export default choices;
