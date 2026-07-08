import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$\\frac{1}{20}$$", value: false },
    { label: "$$\\frac{1}{10}$$", value: false },
    { label: "$$\\frac{1}{8}$$", value: false },
    { label: "$$\\frac{1}{4}$$", value: false },
    { label: "$$\\frac{3}{4}$$", value: true },
  ],
  en: [
    { label: "$$\\frac{1}{20}$$", value: false },
    { label: "$$\\frac{1}{10}$$", value: false },
    { label: "$$\\frac{1}{8}$$", value: false },
    { label: "$$\\frac{1}{4}$$", value: false },
    { label: "$$\\frac{3}{4}$$", value: true },
  ],
};

export default choices;
