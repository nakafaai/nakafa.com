import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$P > Q$$", value: false },
    { label: "$$P < Q$$", value: true },
    { label: "$$P = Q$$", value: false },
    { label: "$$P = 2Q$$", value: false },
    { label: "Tidak dapat ditentukan hubungan $$P$$ dan $$Q$$", value: false },
  ],
  en: [
    { label: "$$P > Q$$", value: false },
    { label: "$$P < Q$$", value: true },
    { label: "$$P = Q$$", value: false },
    { label: "$$P = 2Q$$", value: false },
    {
      label: "Cannot determine the relationship between $$P$$ and $$Q$$",
      value: false,
    },
  ],
};

export default choices;
