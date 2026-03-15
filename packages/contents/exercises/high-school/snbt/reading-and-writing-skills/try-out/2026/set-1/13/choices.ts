import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Kata _perubahan_ pada kalimat $$(2)$$.",
      value: false,
    },
    {
      label: "Kata _peruntukannya_ pada kalimat $$(3)$$.",
      value: false,
    },
    {
      label: "Kata _permasalahan_ pada kalimat $$(5)$$.",
      value: false,
    },
    {
      label: "Kata _permukiman_ pada kalimat $$(7)$$.",
      value: false,
    },
    {
      label: "Kata _menghasilkan_ pada kalimat $$(10)$$.",
      value: true,
    },
  ],
  en: [
    {
      label: "The word _change_ in sentence $$(2)$$.",
      value: false,
    },
    {
      label: "The phrase _intended purpose_ in sentence $$(3)$$.",
      value: false,
    },
    {
      label: "The word _problem_ in sentence $$(5)$$.",
      value: false,
    },
    {
      label: "The word _settlement_ in sentence $$(7)$$.",
      value: false,
    },
    {
      label: "The word _produce_ in sentence $$(10)$$.",
      value: true,
    },
  ],
};

export default choices;
