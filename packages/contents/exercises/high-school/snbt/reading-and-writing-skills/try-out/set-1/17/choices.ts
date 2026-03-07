import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "antara kalimat $$(5)$$ dan $$(6)$$.",
      value: false,
    },
    {
      label: "sebelum kalimat $$(7)$$.",
      value: false,
    },
    {
      label: "antara kalimat $$(1)$$ dan $$(2)$$.",
      value: false,
    },
    {
      label: "setelah kalimat $$(3)$$.",
      value: false,
    },
    {
      label: "antara kalimat $$(4)$$ dan $$(5)$$.",
      value: true,
    },
  ],
  en: [
    {
      label: "between sentences $$(5)$$ and $$(6)$$.",
      value: false,
    },
    {
      label: "before sentence $$(7)$$.",
      value: false,
    },
    {
      label: "between sentences $$(1)$$ and $$(2)$$.",
      value: false,
    },
    {
      label: "after sentence $$(3)$$.",
      value: false,
    },
    {
      label: "between sentences $$(4)$$ and $$(5)$$.",
      value: true,
    },
  ],
};

export default choices;
