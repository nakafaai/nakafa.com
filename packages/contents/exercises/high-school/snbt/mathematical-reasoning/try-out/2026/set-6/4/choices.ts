import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$7$$ bulan", value: false },
    { label: "$$8$$ bulan", value: false },
    { label: "$$9$$ bulan", value: false },
    { label: "$$10$$ bulan", value: true },
    { label: "$$12$$ bulan", value: false },
  ],
  en: [
    { label: "$$7$$ months", value: false },
    { label: "$$8$$ months", value: false },
    { label: "$$9$$ months", value: false },
    { label: "$$10$$ months", value: true },
    { label: "$$12$$ months", value: false },
  ],
};

export default choices;
