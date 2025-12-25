import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$120.000$$ rupiah", value: false },
    { label: "$$160.000$$ rupiah", value: false },
    { label: "$$200.000$$ rupiah", value: false },
    { label: "$$240.000$$ rupiah", value: true },
    { label: "$$280.000$$ rupiah", value: false },
  ],
  en: [
    { label: "$$120,000$$ rupiah", value: false },
    { label: "$$160,000$$ rupiah", value: false },
    { label: "$$200,000$$ rupiah", value: false },
    { label: "$$240,000$$ rupiah", value: true },
    { label: "$$280,000$$ rupiah", value: false },
  ],
};

export default choices;
