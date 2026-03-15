import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$85$$ km/jam", value: false },
    { label: "$$95$$ km/jam", value: false },
    { label: "$$80$$ km/jam", value: false },
    { label: "$$75$$ km/jam", value: true },
    { label: "$$90$$ km/jam", value: false },
  ],
  en: [
    { label: "$$85$$ km/h", value: false },
    { label: "$$95$$ km/h", value: false },
    { label: "$$80$$ km/h", value: false },
    { label: "$$75$$ km/h", value: true },
    { label: "$$90$$ km/h", value: false },
  ],
};

export default choices;
