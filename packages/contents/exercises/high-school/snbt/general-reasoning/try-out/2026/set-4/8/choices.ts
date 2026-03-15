import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Tempe memiliki kandungan energi lebih tinggi dibandingkan daging sapi",
      value: false,
    },
    {
      label:
        "Tempe memiliki sedikit kandungan nutrisi dibandingkan daging sapi",
      value: false,
    },
    {
      label:
        "Daging sapi memiliki banyak keunggulan nutrisi dibandingkan tempe",
      value: false,
    },
    {
      label:
        "Kandungan protein dalam tempe lebih besar $$3,3 \\%$$ dibandingkan kandungan protein dalam daging sapi",
      value: true,
    },
    {
      label:
        "Kandungan lemak dalam sapi lebih besar $$12,2 \\%$$ dibandingkan kandungan lemak dalam tempe",
      value: false,
    },
  ],
  en: [
    {
      label: "Tempeh has higher energy content compared to beef",
      value: false,
    },
    {
      label: "Tempeh has little nutritional content compared to beef",
      value: false,
    },
    {
      label: "Beef has many nutritional advantages compared to tempeh",
      value: false,
    },
    {
      label:
        "Protein content in tempeh is $$3.3 \\%$$ greater than protein content in beef",
      value: true,
    },
    {
      label:
        "Fat content in beef is $$12.2 \\%$$ greater than fat content in tempeh",
      value: false,
    },
  ],
};

export default choices;
