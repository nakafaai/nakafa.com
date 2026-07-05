import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "Sains", value: false },
    { label: "Kamus", value: true },
    { label: "Agama", value: false },
    { label: "Sastra", value: false },
    { label: "Sejarah", value: false },
  ],
  en: [
    { label: "Science", value: false },
    { label: "Dictionary", value: true },
    { label: "Religion", value: false },
    { label: "Literature", value: false },
    { label: "History", value: false },
  ],
};

export default choices;
