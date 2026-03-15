import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$25,0\\%$$", value: false },
    { label: "$$37,5\\%$$", value: false },
    { label: "$$50,0\\%$$", value: false },
    { label: "$$62,5\\%$$", value: false },
    { label: "$$66,7\\%$$", value: true },
  ],
  en: [
    { label: "$$25.0\\%$$", value: false },
    { label: "$$37.5\\%$$", value: false },
    { label: "$$50.0\\%$$", value: false },
    { label: "$$62.5\\%$$", value: false },
    { label: "$$66.7\\%$$", value: true },
  ],
};

export default choices;
