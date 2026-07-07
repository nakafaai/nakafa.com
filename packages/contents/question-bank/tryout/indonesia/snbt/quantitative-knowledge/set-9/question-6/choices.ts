import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$0$$ dan $$2$$", value: false },
    { label: "$$1$$ dan $$2$$", value: false },
    { label: "$$-1$$ dan $$0$$", value: true },
    { label: "$$-2$$ dan $$2$$", value: false },
    { label: "$$-2$$ dan $$1$$", value: false },
  ],
  en: [
    { label: "$$0$$ and $$2$$", value: false },
    { label: "$$1$$ and $$2$$", value: false },
    { label: "$$-1$$ and $$0$$", value: true },
    { label: "$$-2$$ and $$2$$", value: false },
    { label: "$$-2$$ and $$1$$", value: false },
  ],
};

export default choices;
