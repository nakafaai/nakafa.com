import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$1\\text{ jam}$$", value: false },
    { label: "$$1\\text{ jam} 30\\text{ menit}$$", value: false },
    { label: "$$2\\text{ jam}$$", value: false },
    { label: "$$2\\text{ jam} 30\\text{ menit}$$", value: false },
    { label: "$$3\\text{ jam}$$", value: true },
  ],
  en: [
    { label: "$$1\\text{ hour}$$", value: false },
    { label: "$$1\\text{ hour} 30\\text{ minutes}$$", value: false },
    { label: "$$2\\text{ hours}$$", value: false },
    { label: "$$2\\text{ hours} 30\\text{ minutes}$$", value: false },
    { label: "$$3\\text{ hours}$$", value: true },
  ],
};

export default choices;
