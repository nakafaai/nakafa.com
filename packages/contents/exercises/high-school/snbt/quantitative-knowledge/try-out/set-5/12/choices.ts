import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Jika $$(1)$$, $$(2)$$, dan $$(3)$$ yang betul.", value: false },
    { label: "Jika $$(1)$$ dan $$(3)$$ yang betul.", value: false },
    { label: "Jika $$(2)$$ dan $$(4)$$ yang betul.", value: false },
    { label: "Jika $$(4)$$ saja yang betul.", value: false },
    { label: "Jika semua betul.", value: true },
  ],
  en: [
    { label: "If $$(1)$$, $$(2)$$, and $$(3)$$ are correct.", value: false },
    { label: "If $$(1)$$ and $$(3)$$ are correct.", value: false },
    { label: "If $$(2)$$ and $$(4)$$ are correct.", value: false },
    { label: "If only $$(4)$$ is correct.", value: false },
    { label: "If all are correct.", value: true },
  ],
};

export default choices;
