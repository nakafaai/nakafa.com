import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$x < y$$", value: false },
    { label: "$$x > y$$", value: true },
    { label: "$$x = y$$", value: false },
    { label: "$$x = -y$$", value: false },
    { label: "$$x + y = 1$$", value: false },
  ],
  en: [
    { label: "$$x < y$$", value: false },
    { label: "$$x > y$$", value: true },
    { label: "$$x = y$$", value: false },
    { label: "$$x = -y$$", value: false },
    { label: "$$x + y = 1$$", value: false },
  ],
};

export default choices;
