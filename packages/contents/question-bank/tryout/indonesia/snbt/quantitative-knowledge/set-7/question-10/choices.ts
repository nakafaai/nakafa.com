import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$P > Q$$", value: true },
    { label: "$$P < Q$$", value: false },
    { label: "$$P = Q$$", value: false },
    { label: "$$PQ = 32$$", value: false },
    { label: "Tidak dapat ditentukan", value: false },
  ],
  en: [
    { label: "$$P > Q$$", value: true },
    { label: "$$P < Q$$", value: false },
    { label: "$$P = Q$$", value: false },
    { label: "$$PQ = 32$$", value: false },
    { label: "Cannot be determined", value: false },
  ],
};

export default choices;
