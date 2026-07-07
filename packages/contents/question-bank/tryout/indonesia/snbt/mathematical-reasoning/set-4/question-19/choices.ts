import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$250\\sqrt{3}\\text{ meter}$$", value: true },
    { label: "$$250\\sqrt{2}\\text{ meter}$$", value: false },
    { label: "$$500\\sqrt{3}\\text{ meter}$$", value: false },
    { label: "$$500\\sqrt{2}\\text{ meter}$$", value: false },
    { label: "$$250\\text{ meter}$$", value: false },
  ],
  en: [
    { label: "$$250\\sqrt{3}\\text{ meter}$$", value: true },
    { label: "$$250\\sqrt{2}\\text{ meter}$$", value: false },
    { label: "$$500\\sqrt{3}\\text{ meter}$$", value: false },
    { label: "$$500\\sqrt{2}\\text{ meter}$$", value: false },
    { label: "$$250\\text{ meter}$$", value: false },
  ],
};

export default choices;
