import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Beras merah memiliki kandungan serat dan mineral tinggi",
      value: false,
    },
    {
      label:
        "Beras merah bisa dikonsumsi setiap hari bagi mereka yang sedang berdiet",
      value: false,
    },
    {
      label:
        "Nasi merah tidak memiliki serat tinggi atau membuat cepat kenyang dan tidak makan berlebihan",
      value: false,
    },
    {
      label:
        "Nasi merah memiliki serat tinggi dan tidak membuat cepat kenyang atau makan berlebihan",
      value: true,
    },
    {
      label:
        "Nasi merah memiliki tinggi serat, kaya mineral namun rendah lemak sehingga dijadikan asupan utama bagi yang sedang berdiet",
      value: false,
    },
  ],
  en: [
    { label: "Brown rice has high fiber and mineral content", value: false },
    {
      label: "Brown rice can be consumed every day for those who are dieting",
      value: false,
    },
    {
      label:
        "Brown rice does not have high fiber or makes one feel full faster and not overeat",
      value: false,
    },
    {
      label:
        "Brown rice has high fiber and does not make one feel full faster or lead to overeating",
      value: true,
    },
    {
      label:
        "Brown rice is high in fiber, rich in minerals but low in fat so it is used as the main intake for those who are dieting",
      value: false,
    },
  ],
};

export default choices;
