import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$\\text{Rp}10.000$$",
      value: true,
    },
    {
      label: "$$\\text{Rp}20.000$$",
      value: false,
    },
    {
      label: "$$\\text{Rp}30.000$$",
      value: false,
    },
    {
      label: "$$\\text{Rp}40.000$$",
      value: false,
    },
    {
      label: "$$\\text{Rp}45.000$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\text{Rp}10{,}000$$",
      value: true,
    },
    {
      label: "$$\\text{Rp}20{,}000$$",
      value: false,
    },
    {
      label: "$$\\text{Rp}30{,}000$$",
      value: false,
    },
    {
      label: "$$\\text{Rp}40{,}000$$",
      value: false,
    },
    {
      label: "$$\\text{Rp}45{,}000$$",
      value: false,
    },
  ],
};

export default choices;
