import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$A = B$$", value: false },
    { label: "$$A = 2B$$", value: false },
    { label: "$$A > B$$", value: true },
    { label: "$$A < B$$", value: false },
    { label: "$$A = \\frac{1}{2}B$$", value: false },
  ],
  en: [
    { label: "$$A = B$$", value: false },
    { label: "$$A = 2B$$", value: false },
    { label: "$$A > B$$", value: true },
    { label: "$$A < B$$", value: false },
    { label: "$$A = \\frac{1}{2}B$$", value: false },
  ],
};

export default choices;
