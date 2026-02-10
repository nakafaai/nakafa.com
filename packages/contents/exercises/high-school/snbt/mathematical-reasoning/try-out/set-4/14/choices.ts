import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$7$$ hari", value: false },
    { label: "$$8$$ hari", value: false },
    { label: "$$9$$ hari", value: false },
    { label: "$$10$$ hari", value: true },
    { label: "$$11$$ hari", value: false },
  ],
  en: [
    { label: "$$7$$ days", value: false },
    { label: "$$8$$ days", value: false },
    { label: "$$9$$ days", value: false },
    { label: "$$10$$ days", value: true },
    { label: "$$11$$ days", value: false },
  ],
};

export default choices;
