import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "khasiat susu bagi tubuh kita.",
      value: false,
    },
    {
      label: "kita harus minum susu agar sehat.",
      value: false,
    },
    {
      label: "khasiat susu tidak diragukan lagi.",
      value: false,
    },
    {
      label: "tidak setiap orang dapat mengonsumsi susu.",
      value: true,
    },
    {
      label: "sifat biologis memengaruhi orang minum susu.",
      value: false,
    },
  ],
  en: [
    {
      label: "the benefits of milk for our bodies.",
      value: false,
    },
    {
      label: "we should drink milk to be healthy.",
      value: false,
    },
    {
      label: "the benefits of milk are beyond doubt.",
      value: false,
    },
    {
      label: "not everyone can consume milk.",
      value: true,
    },
    {
      label: "biological traits affect people drinking milk.",
      value: false,
    },
  ],
};

export default choices;
