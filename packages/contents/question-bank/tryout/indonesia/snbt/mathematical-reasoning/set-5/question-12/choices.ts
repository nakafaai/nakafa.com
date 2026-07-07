import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$\\text{Rp12.000{,}00}$$", value: false },
    { label: "$$\\text{Rp12.100{,}00}$$", value: false },
    { label: "$$\\text{Rp12.200{,}00}$$", value: false },
    { label: "$$\\text{Rp12.320{,}00}$$", value: true },
    { label: "$$\\text{Rp12.500{,}00}$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp12{,}000.00}$$", value: false },
    { label: "$$\\text{Rp12{,}100.00}$$", value: false },
    { label: "$$\\text{Rp12{,}200.00}$$", value: false },
    { label: "$$\\text{Rp12{,}320.00}$$", value: true },
    { label: "$$\\text{Rp12{,}500.00}$$", value: false },
  ],
};

export default choices;
