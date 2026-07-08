import type { QuestionChoices } from "@repo/contents/_types/question-bank/choices";

const choices: QuestionChoices = {
  id: [
    { label: "$$48$$ hari", value: false },
    { label: "$$48{,}5$$ hari", value: false },
    { label: "$$49$$ hari", value: false },
    { label: "$$49{,}5$$ hari", value: true },
    { label: "$$50$$ hari", value: false },
  ],
  en: [
    { label: "$$48$$ days", value: false },
    { label: "$$48.5$$ days", value: false },
    { label: "$$49$$ days", value: false },
    { label: "$$49.5$$ days", value: true },
    { label: "$$50$$ days", value: false },
  ],
};

export default choices;
