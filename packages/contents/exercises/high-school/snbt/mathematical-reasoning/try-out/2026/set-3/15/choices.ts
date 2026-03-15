import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$0,15$$ bagian", value: false },
    { label: "$$0,3$$ bagian", value: false },
    { label: "$$0,45$$ bagian", value: false },
    { label: "$$0,6$$ bagian", value: false },
    { label: "$$0,75$$ bagian", value: true },
  ],
  en: [
    { label: "$$0.15$$ part", value: false },
    { label: "$$0.3$$ part", value: false },
    { label: "$$0.45$$ part", value: false },
    { label: "$$0.6$$ part", value: false },
    { label: "$$0.75$$ part", value: true },
  ],
};

export default choices;
