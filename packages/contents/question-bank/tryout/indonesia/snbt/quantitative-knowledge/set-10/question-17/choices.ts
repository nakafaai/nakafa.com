import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$\\frac{1}{3}$$", value: false },
    { label: "$$\\frac{2}{3}$$", value: false },
    { label: "$$0{,}5$$", value: true },
    { label: "$$0{,}333$$", value: false },
    { label: "$$\\frac{1}{4}$$", value: false },
  ],
  en: [
    { label: "$$\\frac{1}{3}$$", value: false },
    { label: "$$\\frac{2}{3}$$", value: false },
    { label: "$$0.5$$", value: true },
    { label: "$$0.333$$", value: false },
    { label: "$$\\frac{1}{4}$$", value: false },
  ],
};

export default choices;
