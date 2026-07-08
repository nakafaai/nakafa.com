import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$\\text{it}$$", value: false },
    { label: "$$\\text{pit}$$", value: false },
    { label: "$$\\text{sit}$$", value: false },
    { label: "$$\\text{nit}$$", value: true },
    { label: "tidak ada satupun", value: false },
  ],
  en: [
    { label: "$$\\text{it}$$", value: false },
    { label: "$$\\text{pit}$$", value: false },
    { label: "$$\\text{sit}$$", value: false },
    { label: "$$\\text{nit}$$", value: true },
    { label: "none of the above", value: false },
  ],
};

export default choices;
