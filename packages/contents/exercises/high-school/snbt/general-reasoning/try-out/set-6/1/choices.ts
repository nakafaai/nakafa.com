import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Ayam", value: false },
    { label: "Sapi", value: false },
    { label: "Kelinci", value: false },
    { label: "Domba", value: true },
    { label: "Bebek", value: false },
  ],
  en: [
    { label: "Chicken", value: false },
    { label: "Beef", value: false },
    { label: "Rabbit", value: false },
    { label: "Lamb", value: true },
    { label: "Duck", value: false },
  ],
};

export default choices;
