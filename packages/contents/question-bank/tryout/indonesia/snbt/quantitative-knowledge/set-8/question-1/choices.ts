import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$\\frac{1}{3}$$", value: false },
    { label: "$$\\frac{32}{99}$$", value: false },
    { label: "$$\\frac{23}{99}$$", value: false },
    { label: "$$\\frac{232}{999}$$", value: false },
    { label: "$$\\frac{323}{999}$$", value: true },
  ],
  en: [
    { label: "$$\\frac{1}{3}$$", value: false },
    { label: "$$\\frac{32}{99}$$", value: false },
    { label: "$$\\frac{23}{99}$$", value: false },
    { label: "$$\\frac{232}{999}$$", value: false },
    { label: "$$\\frac{323}{999}$$", value: true },
  ],
};

export default choices;
