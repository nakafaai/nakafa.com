import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$6{,}25$$", value: false },
    { label: "$$6{,}50$$", value: false },
    { label: "$$7{,}50$$", value: false },
    { label: "$$7{,}75$$", value: false },
    { label: "$$8{,}25$$", value: true },
  ],
  en: [
    { label: "$$6.25$$", value: false },
    { label: "$$6.50$$", value: false },
    { label: "$$7.50$$", value: false },
    { label: "$$7.75$$", value: false },
    { label: "$$8.25$$", value: true },
  ],
};

export default choices;
