import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$P < Q$$", value: false },
    { label: "$$P > Q$$", value: true },
    { label: "$$P = Q$$", value: false },
    { label: "$$P = 2Q$$", value: false },
    { label: "Hubungan $$P$$ dan $$Q$$ tidak dapat ditentukan", value: false },
  ],
  en: [
    { label: "$$P < Q$$", value: false },
    { label: "$$P > Q$$", value: true },
    { label: "$$P = Q$$", value: false },
    { label: "$$P = 2Q$$", value: false },
    {
      label: "The relationship between $$P$$ and $$Q$$ cannot be determined",
      value: false,
    },
  ],
};

export default choices;
