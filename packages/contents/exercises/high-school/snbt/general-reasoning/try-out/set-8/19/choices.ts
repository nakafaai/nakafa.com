import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$60$$ dan $$155$$ orang", value: false },
    { label: "$$60$$ dan $$145$$ orang", value: true },
    { label: "$$62$$ dan $$155$$ orang", value: false },
    { label: "$$62$$ dan $$145$$ orang", value: false },
    { label: "$$65$$ dan $$155$$ orang", value: false },
  ],
  en: [
    { label: "$$60$$ and $$155$$ people", value: false },
    { label: "$$60$$ and $$145$$ people", value: true },
    { label: "$$62$$ and $$155$$ people", value: false },
    { label: "$$62$$ and $$145$$ people", value: false },
    { label: "$$65$$ and $$155$$ people", value: false },
  ],
};

export default choices;
