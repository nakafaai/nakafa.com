import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$(1)$$, $$(2)$$, dan $$(3)$$ SAJA yang benar.", value: false },
    { label: "$$(1)$$ dan $$(3)$$ SAJA yang benar.", value: true },
    { label: "$$(2)$$ dan $$(4)$$ SAJA yang benar.", value: false },
    { label: "HANYA $$(4)$$ yang benar.", value: false },
    { label: "SEMUA pilihan benar.", value: false },
  ],
  en: [
    { label: "$$(1)$$, $$(2)$$, and $$(3)$$ ONLY are correct.", value: false },
    { label: "$$(1)$$ and $$(3)$$ ONLY are correct.", value: true },
    { label: "$$(2)$$ and $$(4)$$ ONLY are correct.", value: false },
    { label: "ONLY $$(4)$$ is correct.", value: false },
    { label: "ALL choices are correct.", value: false },
  ],
};

export default choices;
