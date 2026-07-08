import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$x > y$$", value: false },
    { label: "$$x < y$$", value: true },
    { label: "$$x = y$$", value: false },
    { label: "$$2x = y$$", value: false },
    { label: "$$x = 4y$$", value: false },
  ],
  en: [
    { label: "$$x > y$$", value: false },
    { label: "$$x < y$$", value: true },
    { label: "$$x = y$$", value: false },
    { label: "$$2x = y$$", value: false },
    { label: "$$x = 4y$$", value: false },
  ],
};

export default choices;
