import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$\\text{Rp }950{,}00$$", value: false },
    { label: "$$\\text{Rp }1.050{,}00$$", value: false },
    { label: "$$\\text{Rp }1.150{,}00$$", value: false },
    { label: "$$\\text{Rp }1.250{,}00$$", value: true },
    { label: "$$\\text{Rp }1.350{,}00$$", value: false },
  ],
  en: [
    { label: "$$\\text{Rp }950.00$$", value: false },
    { label: "$$\\text{Rp }1{,}050.00$$", value: false },
    { label: "$$\\text{Rp }1{,}150.00$$", value: false },
    { label: "$$\\text{Rp }1{,}250.00$$", value: true },
    { label: "$$\\text{Rp }1{,}350.00$$", value: false },
  ],
};

export default choices;
