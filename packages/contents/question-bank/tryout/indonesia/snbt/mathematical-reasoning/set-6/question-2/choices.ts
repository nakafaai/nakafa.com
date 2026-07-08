import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$0{,}50$$ Km", value: false },
    { label: "$$1{,}22$$ Km", value: false },
    { label: "$$1{,}44$$ Km", value: true },
    { label: "$$2{,}40$$ Km", value: false },
    { label: "$$2{,}50$$ Km", value: false },
  ],
  en: [
    { label: "$$0.50$$ Km", value: false },
    { label: "$$1.22$$ Km", value: false },
    { label: "$$1.44$$ Km", value: true },
    { label: "$$2.40$$ Km", value: false },
    { label: "$$2.50$$ Km", value: false },
  ],
};

export default choices;
