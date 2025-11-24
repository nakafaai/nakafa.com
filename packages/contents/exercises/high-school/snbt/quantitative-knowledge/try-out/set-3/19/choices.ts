import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$1,5$$ cm",
      value: true,
    },
    {
      label: "$$2$$ cm",
      value: false,
    },
    {
      label: "$$2,5$$ cm",
      value: false,
    },
    {
      label: "$$3$$ cm",
      value: false,
    },
    {
      label: "$$3,5$$ cm",
      value: false,
    },
  ],
  en: [
    {
      label: "$$1.5$$ cm",
      value: true,
    },
    {
      label: "$$2$$ cm",
      value: false,
    },
    {
      label: "$$2.5$$ cm",
      value: false,
    },
    {
      label: "$$3$$ cm",
      value: false,
    },
    {
      label: "$$3.5$$ cm",
      value: false,
    },
  ],
};

export default choices;
