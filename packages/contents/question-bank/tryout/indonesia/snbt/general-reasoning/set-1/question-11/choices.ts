import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$0 \\leq x \\leq 30$$", value: false },
    { label: "$$30 \\leq x \\leq 35$$", value: false },
    { label: "$$30 \\leq x \\leq 40$$", value: true },
    { label: "$$20 \\leq x \\leq 30$$", value: false },
    { label: "Tidak dapat ditentukan", value: false },
  ],
  en: [
    { label: "$$0 \\leq x \\leq 30$$", value: false },
    { label: "$$30 \\leq x \\leq 35$$", value: false },
    { label: "$$30 \\leq x \\leq 40$$", value: true },
    { label: "$$20 \\leq x \\leq 30$$", value: false },
    { label: "Cannot be determined", value: false },
  ],
};

export default choices;
