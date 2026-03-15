import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$57$$ kal", value: false },
    { label: "$$70$$ kal", value: false },
    { label: "$$71,25$$ kal", value: true },
    { label: "$$72$$ kal", value: false },
    { label: "$$87,72$$ kal", value: false },
  ],
  en: [
    { label: "$$57$$ cal", value: false },
    { label: "$$70$$ cal", value: false },
    { label: "$$71.25$$ cal", value: true },
    { label: "$$72$$ cal", value: false },
    { label: "$$87.72$$ cal", value: false },
  ],
};

export default choices;
