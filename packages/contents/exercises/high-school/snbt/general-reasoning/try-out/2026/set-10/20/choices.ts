import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$3$$ saja", value: true },
    { label: "$$1$$ dan $$4$$", value: false },
    { label: "$$3$$ dan $$4$$", value: false },
    { label: "$$2, 3,$$ dan $$4$$", value: false },
    { label: "$$1, 2, 3,$$ dan $$4$$", value: false },
  ],
  en: [
    { label: "$$3$$ only", value: true },
    { label: "$$1$$ and $$4$$", value: false },
    { label: "$$3$$ and $$4$$", value: false },
    { label: "$$2, 3,$$ and $$4$$", value: false },
    { label: "$$1, 2, 3,$$ and $$4$$", value: false },
  ],
};

export default choices;
