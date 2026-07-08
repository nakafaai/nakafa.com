import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$85 \\text{ km/jam}$$", value: false },
    { label: "$$95 \\text{ km/jam}$$", value: false },
    { label: "$$80 \\text{ km/jam}$$", value: false },
    { label: "$$75 \\text{ km/jam}$$", value: true },
    { label: "$$90 \\text{ km/jam}$$", value: false },
  ],
  en: [
    { label: "$$85 \\text{ km/h}$$", value: false },
    { label: "$$95 \\text{ km/h}$$", value: false },
    { label: "$$80 \\text{ km/h}$$", value: false },
    { label: "$$75 \\text{ km/h}$$", value: true },
    { label: "$$90 \\text{ km/h}$$", value: false },
  ],
};

export default choices;
