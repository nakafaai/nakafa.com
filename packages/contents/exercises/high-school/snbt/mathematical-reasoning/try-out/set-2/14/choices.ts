import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$3,6$$ menit", value: false },
    { label: "$$4,8$$ menit", value: true },
    { label: "$$7,2$$ menit", value: false },
    { label: "$$7,8$$ menit", value: false },
    { label: "$$8,0$$ menit", value: false },
  ],
  en: [
    { label: "$$3.6$$ minutes", value: false },
    { label: "$$4.8$$ minutes", value: true },
    { label: "$$7.2$$ minutes", value: false },
    { label: "$$7.8$$ minutes", value: false },
    { label: "$$8.0$$ minutes", value: false },
  ],
};

export default choices;
