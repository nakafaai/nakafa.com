import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$0{,}9$$", value: false },
    { label: "$$1{,}9$$", value: false },
    { label: "$$2{,}3$$", value: false },
    { label: "$$2{,}6$$", value: false },
    { label: "$$3{,}6$$", value: true },
  ],
  en: [
    { label: "$$0.9$$", value: false },
    { label: "$$1.9$$", value: false },
    { label: "$$2.3$$", value: false },
    { label: "$$2.6$$", value: false },
    { label: "$$3.6$$", value: true },
  ],
};

export default choices;
