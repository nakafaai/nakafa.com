import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$1$$ dan $$2$$", value: false },
    { label: "$$2$$ dan $$4$$", value: true },
    { label: "$$2$$, $$3$$, dan $$4$$", value: false },
    { label: "$$1$$, $$3$$, dan $$4$$", value: false },
    { label: "$$1$$, $$2$$, $$3$$, dan $$4$$", value: false },
  ],
  en: [
    { label: "$$1$$ and $$2$$", value: false },
    { label: "$$2$$ and $$4$$", value: true },
    { label: "$$2$$, $$3$$, and $$4$$", value: false },
    { label: "$$1$$, $$3$$, and $$4$$", value: false },
    { label: "$$1$$, $$2$$, $$3$$, and $$4$$", value: false },
  ],
};

export default choices;
