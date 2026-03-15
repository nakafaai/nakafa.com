import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Jika mengkonsumsi tempe, maka akan mendapatkan sedikit lemak",
      value: false,
    },
    {
      label:
        "Jika mengkonsumsi daging, maka nutrisi yang didapat hanya sedikit",
      value: false,
    },
    {
      label:
        "Jika mengkonsumsi tempe, maka nutrisi yang didapat lebih banyak dibandingkan nutrisi dalam daging sapi",
      value: false,
    },
    {
      label: "Jika mengkonsumsi tempe maka akan mendapatkan sedikit energi",
      value: false,
    },
    {
      label:
        "Jika mengkonsumsi daging maka akan mendapatkan banyak energi dan lemak",
      value: true,
    },
  ],
  en: [
    {
      label: "If consuming tempeh, then one will get little fat",
      value: false,
    },
    {
      label: "If consuming meat, then the nutrients obtained are only few",
      value: false,
    },
    {
      label:
        "If consuming tempeh, then the nutrients obtained are more than the nutrients in beef",
      value: false,
    },
    {
      label: "If consuming tempeh, then one will get little energy",
      value: false,
    },
    {
      label: "If consuming meat, then one will get a lot of energy and fat",
      value: true,
    },
  ],
};

export default choices;
