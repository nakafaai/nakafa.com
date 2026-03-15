import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$15,7\\%$$", value: false },
    { label: "$$28,3\\%$$", value: false },
    { label: "$$34,5\\%$$", value: false },
    { label: "$$41,8\\%$$", value: false },
    { label: "$$52,3\\%$$", value: true },
  ],
  en: [
    { label: "$$15.7\\%$$", value: false },
    { label: "$$28.3\\%$$", value: false },
    { label: "$$34.5\\%$$", value: false },
    { label: "$$41.8\\%$$", value: false },
    { label: "$$52.3\\%$$", value: true },
  ],
};

export default choices;
