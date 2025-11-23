import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

// Date: 11/23/2025
const choices: ExercisesChoices = {
  id: [
    {
      label: "BBS",
      value: false,
    },
    {
      label: "BSB",
      value: true,
    },
    {
      label: "BSS",
      value: false,
    },
    {
      label: "SBB",
      value: false,
    },
    {
      label: "SBS",
      value: false,
    },
  ],
  en: [
    {
      label: "T TF",
      value: false,
    },
    {
      label: "TFT",
      value: true,
    },
    {
      label: "TFF",
      value: false,
    },
    {
      label: "FTT",
      value: false,
    },
    {
      label: "FTF",
      value: false,
    },
  ],
};

export default choices;
