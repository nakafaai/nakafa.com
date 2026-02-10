import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$70$$ menit atau $$30$$ menit", value: true },
    { label: "$$21$$ menit atau $$10$$ menit", value: false },
    { label: "$$15$$ menit atau $$16$$ menit", value: false },
    { label: "$$30$$ menit atau $$40$$ menit", value: false },
    { label: "$$10$$ menit atau $$30$$ menit", value: false },
  ],
  en: [
    { label: "$$70$$ minutes or $$30$$ minutes", value: true },
    { label: "$$21$$ minutes or $$10$$ minutes", value: false },
    { label: "$$15$$ minutes or $$16$$ minutes", value: false },
    { label: "$$30$$ minutes or $$40$$ minutes", value: false },
    { label: "$$10$$ minutes or $$30$$ minutes", value: false },
  ],
};

export default choices;
