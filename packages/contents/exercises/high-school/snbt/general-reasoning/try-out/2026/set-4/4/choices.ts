import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$52,3$$ gr dan $$10,85$$ gr",
      value: false,
    },
    {
      label: "$$52,3$$ gr dan $$10,58$$ gr",
      value: false,
    },
    {
      label: "$$53,2$$ gr dan $$10,58$$ gr",
      value: false,
    },
    {
      label: "$$53,2$$ gr dan $$10,85$$ gr",
      value: true,
    },
    {
      label: "$$52,3$$ gr dan $$10,50$$ gr",
      value: false,
    },
  ],
  en: [
    {
      label: "$$52.3$$ gr and $$10.85$$ gr",
      value: false,
    },
    {
      label: "$$52.3$$ gr and $$10.58$$ gr",
      value: false,
    },
    {
      label: "$$53.2$$ gr and $$10.58$$ gr",
      value: false,
    },
    {
      label: "$$53.2$$ gr and $$10.85$$ gr",
      value: true,
    },
    {
      label: "$$52.3$$ gr and $$10.50$$ gr",
      value: false,
    },
  ],
};

export default choices;
