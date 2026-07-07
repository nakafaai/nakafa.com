import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$h(t) = 8 \\sin 6{,}2 \\pi t$$", value: false },
    { label: "$$h(t) = 8 \\sin \\frac{2\\pi}{6{,}2} t$$", value: false },
    { label: "$$h(t) = 8 \\sin \\frac{2\\pi}{12{,}4} t$$", value: true },
    { label: "$$h(t) = 16 \\sin \\frac{2\\pi}{6{,}2} t$$", value: false },
    { label: "$$h(t) = 16 \\sin \\frac{2\\pi}{12{,}4} t$$", value: false },
  ],
  en: [
    { label: "$$h(t) = 8 \\sin 6.2 \\pi t$$", value: false },
    { label: "$$h(t) = 8 \\sin \\frac{2\\pi}{6.2} t$$", value: false },
    { label: "$$h(t) = 8 \\sin \\frac{2\\pi}{12.4} t$$", value: true },
    { label: "$$h(t) = 16 \\sin \\frac{2\\pi}{6.2} t$$", value: false },
    { label: "$$h(t) = 16 \\sin \\frac{2\\pi}{12.4} t$$", value: false },
  ],
};

export default choices;
