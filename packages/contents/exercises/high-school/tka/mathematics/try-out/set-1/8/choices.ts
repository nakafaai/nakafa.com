import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$\\text{Rp}10.000$$",
      value: false,
    },
    {
      label: "$$\\text{Rp}12.000$$",
      value: true,
    },
    {
      label: "$$\\text{Rp}13.000$$",
      value: false,
    },
    {
      label: "$$\\text{Rp}14.000$$",
      value: false,
    },
    {
      label: "$$\\text{Rp}15.000$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\text{Rp}10{,}000$$",
      value: false,
    },
    {
      label: "$$\\text{Rp}12{,}000$$",
      value: true,
    },
    {
      label: "$$\\text{Rp}13{,}000$$",
      value: false,
    },
    {
      label: "$$\\text{Rp}14{,}000$$",
      value: false,
    },
    {
      label: "$$\\text{Rp}15{,}000$$",
      value: false,
    },
  ],
};

export default choices;
