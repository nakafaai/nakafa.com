import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$-13x - y - 15 = 0$$", value: false },
    { label: "$$13x - y - 15 = 0$$", value: false },
    { label: "$$13x + y - 15 = 0$$", value: true },
    { label: "$$-13x + y - 15 = 0$$", value: false },
    { label: "$$13x + y - 37 = 0$$", value: false },
  ],
  en: [
    { label: "$$-13x - y - 15 = 0$$", value: false },
    { label: "$$13x - y - 15 = 0$$", value: false },
    { label: "$$13x + y - 15 = 0$$", value: true },
    { label: "$$-13x + y - 15 = 0$$", value: false },
    { label: "$$13x + y - 37 = 0$$", value: false },
  ],
};

export default choices;
