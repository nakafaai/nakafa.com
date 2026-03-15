import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$60$$ Orang", value: false },
    { label: "$$48$$ Orang", value: false },
    { label: "$$36$$ Orang", value: true },
    { label: "$$30$$ Orang", value: false },
    { label: "$$20$$ Orang", value: false },
  ],
  en: [
    { label: "$$60$$ People", value: false },
    { label: "$$48$$ People", value: false },
    { label: "$$36$$ People", value: true },
    { label: "$$30$$ People", value: false },
    { label: "$$20$$ People", value: false },
  ],
};

export default choices;
