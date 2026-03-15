import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$97,5$$ km/jam", value: false },
    { label: "$$95,0$$ km/jam", value: false },
    { label: "$$87,5$$ km/jam", value: false },
    { label: "$$85,0$$ km/jam", value: false },
    { label: "$$82,5$$ km/jam", value: true },
  ],
  en: [
    { label: "$$97.5$$ km/h", value: false },
    { label: "$$95.0$$ km/h", value: false },
    { label: "$$87.5$$ km/h", value: false },
    { label: "$$85.0$$ km/h", value: false },
    { label: "$$82.5$$ km/h", value: true },
  ],
};

export default choices;
