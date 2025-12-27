import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$14$$ tahun", value: false },
    { label: "$$17$$ tahun", value: false },
    { label: "$$18$$ tahun", value: true },
    { label: "$$20$$ tahun", value: false },
    { label: "$$22$$ tahun", value: false },
  ],
  en: [
    { label: "$$14$$ years", value: false },
    { label: "$$17$$ years", value: false },
    { label: "$$18$$ years", value: true },
    { label: "$$20$$ years", value: false },
    { label: "$$22$$ years", value: false },
  ],
};

export default choices;
