import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$1$$ jam $$15$$ menit",
      value: false,
    },
    {
      label: "$$1$$ jam $$20$$ menit",
      value: true,
    },
    {
      label: "$$1$$ jam $$30$$ menit",
      value: false,
    },
    {
      label: "$$1$$ jam $$40$$ menit",
      value: false,
    },
    {
      label: "$$1$$ jam $$45$$ menit",
      value: false,
    },
  ],
  en: [
    {
      label: "$$1$$ hour $$15$$ minutes",
      value: false,
    },
    {
      label: "$$1$$ hour $$20$$ minutes",
      value: true,
    },
    {
      label: "$$1$$ hour $$30$$ minutes",
      value: false,
    },
    {
      label: "$$1$$ hour $$40$$ minutes",
      value: false,
    },
    {
      label: "$$1$$ hour $$45$$ minutes",
      value: false,
    },
  ],
};

export default choices;
