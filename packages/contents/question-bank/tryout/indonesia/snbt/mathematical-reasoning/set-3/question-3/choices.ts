import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$\\text{Rp}250.000{,}00$$", value: true },
    { label: "$$\\text{Rp}275.000{,}00$$", value: false },
    { label: "$$\\text{Rp}425.000{,}00$$", value: false },
    { label: "$$\\text{Rp}460.000{,}00$$", value: false },
    { label: "$$\\text{Rp}500.000{,}00$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp}250{,}000.00$$", value: true },
    { label: "$$\\text{Rp}275{,}000.00$$", value: false },
    { label: "$$\\text{Rp}425{,}000.00$$", value: false },
    { label: "$$\\text{Rp}460{,}000.00$$", value: false },
    { label: "$$\\text{Rp}500{,}000.00$$", value: false },
  ],
};

export default choices;
