import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$1,31\\%$$", value: false },
    { label: "$$1,41\\%$$", value: false },
    { label: "$$1,51\\%$$", value: false },
    { label: "$$1,61\\%$$", value: true },
    { label: "$$1,71\\%$$", value: false },
  ],
  en: [
    { label: "$$1.31\\%$$", value: false },
    { label: "$$1.41\\%$$", value: false },
    { label: "$$1.51\\%$$", value: false },
    { label: "$$1.61\\%$$", value: true },
    { label: "$$1.71\\%$$", value: false },
  ],
};

export default choices;
