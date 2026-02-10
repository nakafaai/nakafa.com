import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$180$$ dan $$20$$", value: true },
    { label: "$$180$$ dan $$10$$", value: false },
    { label: "$$170$$ dan $$15$$", value: false },
    { label: "$$170$$ dan $$20$$", value: false },
    { label: "$$160$$ dan $$25$$", value: false },
  ],
  en: [
    { label: "$$180$$ and $$20$$", value: true },
    { label: "$$180$$ and $$10$$", value: false },
    { label: "$$170$$ and $$15$$", value: false },
    { label: "$$170$$ and $$20$$", value: false },
    { label: "$$160$$ and $$25$$", value: false },
  ],
};

export default choices;
