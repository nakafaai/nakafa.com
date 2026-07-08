import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "ong ybeeppz! yum!meeongw", value: false },
    { label: "yum ybeeppzpz! ong!meeongw", value: false },
    { label: "yum !meeongw ongybeeppz!", value: false },
    { label: "yum y!meeongw ongbeeppzpz!", value: true },
    { label: "ong beeppz! yum y!meeongw", value: false },
  ],
  en: [
    { label: "ong ybeeppz! yum!meeongw", value: false },
    { label: "yum ybeeppzpz! ong!meeongw", value: false },
    { label: "yum !meeongw ongybeeppz!", value: false },
    { label: "yum y!meeongw ongbeeppzpz!", value: true },
    { label: "ong beeppz! yum y!meeongw", value: false },
  ],
};

export default choices;
