import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$(1)$$, $$(2)$$, dan $$(3)$$ SAJA yang benar",
      value: false,
    },
    {
      label: "$$(1)$$ dan $$(3)$$ SAJA yang benar",
      value: false,
    },
    {
      label: "$$(2)$$ dan $$(4)$$ SAJA yang benar",
      value: false,
    },
    {
      label: "$$(4)$$ SAJA yang benar",
      value: true,
    },
    {
      label: "SEMUA pernyataan benar",
      value: false,
    },
  ],
  en: [
    {
      label: "$$(1)$$, $$(2)$$, and $$(3)$$ ONLY are true",
      value: false,
    },
    {
      label: "$$(1)$$ and $$(3)$$ ONLY are true",
      value: false,
    },
    {
      label: "$$(2)$$ and $$(4)$$ ONLY are true",
      value: false,
    },
    {
      label: "$$(4)$$ ONLY is true",
      value: true,
    },
    {
      label: "ALL statements are true",
      value: false,
    },
  ],
};

export default choices;
