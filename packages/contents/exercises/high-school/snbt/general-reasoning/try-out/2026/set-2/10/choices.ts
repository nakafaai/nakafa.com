import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "2 apel besar", value: false },
    { label: "2 apel kecil", value: false },
    { label: "2 jeruk besar", value: false },
    { label: "2 jeruk kecil", value: false },
    { label: "1 apel besar dan 1 jeruk kecil", value: true },
  ],
  en: [
    { label: "2 large apples", value: false },
    { label: "2 small apples", value: false },
    { label: "2 large oranges", value: false },
    { label: "2 small oranges", value: false },
    { label: "1 large apple and 1 small orange", value: true },
  ],
};

export default choices;
