import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "Bahan bacaan yang tersedia semua terkenal", value: false },
    {
      label:
        "Banyak fitur yang tersedia pada aplikasi yang memudahkan pengguna",
      value: false,
    },
    { label: "Aplikasi mudah diunduh", value: false },
    { label: "Aplikasi tidak memakan banyak ruang ponsel Anda", value: false },
    { label: "Bacaan tersedia dalam berbagai bahasa", value: true },
  ],
  en: [
    { label: "Bahan bacaan yang tersedia semua terkenal", value: false },
    {
      label:
        "Banyak fitur yang tersedia pada aplikasi yang memudahkan pengguna",
      value: false,
    },
    { label: "Aplikasi mudah diunduh", value: false },
    { label: "Aplikasi tidak memakan banyak ruang ponsel Anda", value: false },
    { label: "Bacaan tersedia dalam berbagai bahasa", value: true },
  ],
};

export default choices;
