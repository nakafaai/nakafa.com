import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "temuan inovatif.",
      value: false,
    },
    {
      label: "timbangan berkarat.",
      value: false,
    },
    {
      label: "latihan menulis.",
      value: false,
    },
    {
      label: "kicauan burung.",
      value: true,
    },
    {
      label: "tulisan sederhana.",
      value: false,
    },
  ],
  en: [
    {
      label: "innovative findings.",
      value: false,
    },
    {
      label: "rusty scales.",
      value: false,
    },
    {
      label: "writing exercises.",
      value: false,
    },
    {
      label: "bird chirps.",
      value: true,
    },
    {
      label: "simple writings.",
      value: false,
    },
  ],
};

export default choices;
