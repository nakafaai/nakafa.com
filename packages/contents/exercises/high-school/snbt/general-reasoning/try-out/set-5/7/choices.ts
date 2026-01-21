import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Anak memiliki sedikit air dan karbohidrat", value: false },
    { label: "Ada anak yang memiliki banyak air", value: false },
    {
      label: "Anak harus mengkonsumsi alpukar agar dapat banyak lemak",
      value: false,
    },
    { label: "Sebagian anak mendapatkan lemak", value: true },
    {
      label: "Ada anak yang mendapatkan karbohidrat dan banyak air",
      value: false,
    },
  ],
  en: [
    { label: "The child has low water and carbohydrate content", value: false },
    { label: "There is a child who has high water content", value: false },
    { label: "The child must consume avocado to get high fat", value: false },
    { label: "Some children get fat", value: true },
    {
      label: "There is a child who gets carbohydrates and high water",
      value: false,
    },
  ],
};

export default choices;
