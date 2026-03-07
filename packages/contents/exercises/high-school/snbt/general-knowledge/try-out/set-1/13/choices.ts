import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Mereka terpesona.",
      value: true,
    },
    {
      label: "Hamparan diselimuti kristal es.",
      value: false,
    },
    {
      label: "Mereka diselimuti kristal es.",
      value: false,
    },
    {
      label: "Terpesona kecantikan hamparan kristal es",
      value: false,
    },
    {
      label: "Diselimuti kristal es bening.",
      value: false,
    },
  ],
  en: [
    {
      label: "They were fascinated.",
      value: true,
    },
    {
      label: "The expanse was covered in ice crystals.",
      value: false,
    },
    {
      label: "They were covered in ice crystals.",
      value: false,
    },
    {
      label: "Fascinated by the beauty of the expanse of ice crystals",
      value: false,
    },
    {
      label: "Covered in clear ice crystals.",
      value: false,
    },
  ],
};

export default choices;
