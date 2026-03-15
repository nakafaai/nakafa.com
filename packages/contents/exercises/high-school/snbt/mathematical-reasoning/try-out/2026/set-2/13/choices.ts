import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$1,2$$ menit", value: false },
    { label: "$$4,8$$ menit", value: false },
    { label: "$$18,8$$ menit", value: false },
    { label: "$$16,8$$ menit", value: true },
    { label: "$$14,2$$ menit", value: false },
  ],
  en: [
    { label: "$$1.2$$ minutes", value: false },
    { label: "$$4.8$$ minutes", value: false },
    { label: "$$18.8$$ minutes", value: false },
    { label: "$$16.8$$ minutes", value: true },
    { label: "$$14.2$$ minutes", value: false },
  ],
};

export default choices;
