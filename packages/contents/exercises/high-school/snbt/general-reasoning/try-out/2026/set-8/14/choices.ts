import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Memperkuat pernyataan A", value: false },
    { label: "Memperlemah pernyataan A", value: false },
    { label: "Memperkuat pernyataan B", value: true },
    { label: "Memperlemah pernyataan B", value: false },
    { label: "Tidak relevan dengan pernyataan A dan B", value: false },
  ],
  en: [
    { label: "Strengthens statement A", value: false },
    { label: "Weakens statement A", value: false },
    { label: "Strengthens statement B", value: true },
    { label: "Weakens statement B", value: false },
    { label: "Irrelevant to statements A and B", value: false },
  ],
};

export default choices;
