import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$(1)$$—$$(5)$$—$$(4)$$—$$(3)$$—$$(2)$$.",
      value: false,
    },
    {
      label: "$$(4)$$—$$(5)$$—$$(1)$$—$$(3)$$—$$(2)$$.",
      value: true,
    },
    {
      label: "$$(4)$$—$$(2)$$—$$(3)$$—$$(1)$$—$$(5)$$.",
      value: false,
    },
    {
      label: "$$(5)$$—$$(4)$$—$$(1)$$—$$(3)$$—$$(2)$$.",
      value: false,
    },
    {
      label: "$$(5)$$—$$(4)$$—$$(1)$$—$$(2)$$—$$(3)$$.",
      value: false,
    },
  ],
  en: [
    {
      label: "$$(1)$$—$$(5)$$—$$(4)$$—$$(3)$$—$$(2)$$.",
      value: false,
    },
    {
      label: "$$(4)$$—$$(5)$$—$$(1)$$—$$(3)$$—$$(2)$$.",
      value: true,
    },
    {
      label: "$$(4)$$—$$(2)$$—$$(3)$$—$$(1)$$—$$(5)$$.",
      value: false,
    },
    {
      label: "$$(5)$$—$$(4)$$—$$(1)$$—$$(3)$$—$$(2)$$.",
      value: false,
    },
    {
      label: "$$(5)$$—$$(4)$$—$$(1)$$—$$(2)$$—$$(3)$$.",
      value: false,
    },
  ],
};

export default choices;
