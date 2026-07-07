import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$1$$", value: false },
    { label: "$$\\frac{1}{2}$$", value: false },
    { label: "$$\\frac{1}{3}$$", value: true },
    { label: "$$\\frac{1}{2}\\sqrt{2}$$", value: false },
    { label: "$$\\frac{1}{3}\\sqrt{3}$$", value: false },
  ],
  en: [
    { label: "$$1$$", value: false },
    { label: "$$\\frac{1}{2}$$", value: false },
    { label: "$$\\frac{1}{3}$$", value: true },
    { label: "$$\\frac{1}{2}\\sqrt{2}$$", value: false },
    { label: "$$\\frac{1}{3}\\sqrt{3}$$", value: false },
  ],
};

export default choices;
