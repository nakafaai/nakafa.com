import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$12,25\\%$$", value: false },
    { label: "$$13,75\\%$$", value: true },
    { label: "$$14,50\\%$$", value: false },
    { label: "$$15,00\\%$$", value: false },
    { label: "$$15,75\\%$$", value: false },
  ],
  en: [
    { label: "$$12.25\\%$$", value: false },
    { label: "$$13.75\\%$$", value: true },
    { label: "$$14.50\\%$$", value: false },
    { label: "$$15.00\\%$$", value: false },
    { label: "$$15.75\\%$$", value: false },
  ],
};

export default choices;
