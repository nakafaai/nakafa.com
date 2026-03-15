import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$2$$ tahun", value: false },
    { label: "$$3$$ tahun", value: false },
    { label: "$$4$$ tahun", value: false },
    { label: "$$5$$ tahun", value: false },
    { label: "$$6$$ tahun", value: true },
  ],
  en: [
    { label: "$$2$$ years", value: false },
    { label: "$$3$$ years", value: false },
    { label: "$$4$$ years", value: false },
    { label: "$$5$$ years", value: false },
    { label: "$$6$$ years", value: true },
  ],
};

export default choices;
