import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$24 \\text{ km/jam}$$",
      value: false,
    },
    {
      label: "$$48 \\text{ km/jam}$$",
      value: false,
    },
    {
      label: "$$72 \\text{ km/jam}$$",
      value: false,
    },
    {
      label: "$$96 \\text{ km/jam}$$",
      value: false,
    },
    {
      label: "$$120 \\text{ km/jam}$$",
      value: true,
    },
  ],
  en: [
    {
      label: "$$24 \\text{ km/h}$$",
      value: false,
    },
    {
      label: "$$48 \\text{ km/h}$$",
      value: false,
    },
    {
      label: "$$72 \\text{ km/h}$$",
      value: false,
    },
    {
      label: "$$96 \\text{ km/h}$$",
      value: false,
    },
    {
      label: "$$120 \\text{ km/h}$$",
      value: true,
    },
  ],
};

export default choices;
