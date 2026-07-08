import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$\\text{Rp}125.000{,}00$$", value: false },
    { label: "$$\\text{Rp}135.650{,}00$$", value: false },
    { label: "$$\\text{Rp}155.000{,}00$$", value: true },
    { label: "$$\\text{Rp}160.000{,}00$$", value: false },
    { label: "$$\\text{Rp}165.000{,}00$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp}125{,}000.00$$", value: false },
    { label: "$$\\text{Rp}135{,}650.00$$", value: false },
    { label: "$$\\text{Rp}155{,}000.00$$", value: true },
    { label: "$$\\text{Rp}160{,}000.00$$", value: false },
    { label: "$$\\text{Rp}165{,}000.00$$", value: false },
  ],
};

export default choices;
