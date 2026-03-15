import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$1$$ snack bouquet dan $$2$$ money bouquet", value: false },
    { label: "$$2$$ snack bouquet dan $$2$$ money bouquet", value: true },
    { label: "$$1$$ bunga besar dan $$2$$ money bouquet", value: false },
    { label: "$$1$$ bunga besar dan $$2$$ snack bouquet", value: false },
    { label: "$$1$$ bunga kecil dan $$2$$ snack bouquet", value: false },
  ],
  en: [
    { label: "$$1$$ snack bouquet and $$2$$ money bouquets", value: false },
    { label: "$$2$$ snack bouquets and $$2$$ money bouquets", value: true },
    { label: "$$1$$ large flower and $$2$$ money bouquets", value: false },
    { label: "$$1$$ large flower and $$2$$ snack bouquets", value: false },
    { label: "$$1$$ small flower and $$2$$ snack bouquets", value: false },
  ],
};

export default choices;
