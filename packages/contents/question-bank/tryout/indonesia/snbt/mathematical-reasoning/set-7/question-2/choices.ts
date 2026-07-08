import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$\\text{Rp}360.000{,}00$$", value: true },
    { label: "$$\\text{Rp}480.000{,}00$$", value: false },
    { label: "$$\\text{Rp}120.000{,}00$$", value: false },
    { label: "$$\\text{Rp}365.000{,}00$$", value: false },
    { label: "$$\\text{Rp}420.000{,}00$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp}360{,}000.00$$", value: true },
    { label: "$$\\text{Rp}480{,}000.00$$", value: false },
    { label: "$$\\text{Rp}120{,}000.00$$", value: false },
    { label: "$$\\text{Rp}365{,}000.00$$", value: false },
    { label: "$$\\text{Rp}420{,}000.00$$", value: false },
  ],
};

export default choices;
