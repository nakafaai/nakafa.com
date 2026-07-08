import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "Tahun ke-$$1$$", value: true },
    { label: "Tahun ke-$$2$$", value: false },
    { label: "Tahun ke-$$3$$", value: false },
    { label: "Tahun ke-$$4$$", value: false },
    { label: "Tahun ke-$$5$$", value: false },
  ],
  en: [
    { label: "Year $$1$$", value: true },
    { label: "Year $$2$$", value: false },
    { label: "Year $$3$$", value: false },
    { label: "Year $$4$$", value: false },
    { label: "Year $$5$$", value: false },
  ],
};

export default choices;
