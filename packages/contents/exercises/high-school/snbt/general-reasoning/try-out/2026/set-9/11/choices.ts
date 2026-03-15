import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$10$$ ribu", value: false },
    { label: "$$30$$ ribu", value: true },
    { label: "$$50$$ ribu", value: false },
    { label: "$$60$$ ribu", value: false },
    { label: "$$80$$ ribu", value: false },
  ],
  en: [
    { label: "$$10$$ thousand", value: false },
    { label: "$$30$$ thousand", value: true },
    { label: "$$50$$ thousand", value: false },
    { label: "$$60$$ thousand", value: false },
    { label: "$$80$$ thousand", value: false },
  ],
};

export default choices;
