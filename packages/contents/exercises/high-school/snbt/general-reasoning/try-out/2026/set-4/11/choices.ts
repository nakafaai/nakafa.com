import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Dito tidak mengerjakan soal TOBK meskipun mengerjakan soal empati bersyarat",
      value: false,
    },
    {
      label:
        "Dito mengerjakan soal TOBK namun tidak mengerjakan soal empati bersyarat",
      value: false,
    },
    {
      label: "Dito bukan siswa Nakafa",
      value: false,
    },
    {
      label: "Dito tidak mengerjakan soal empati bersyarat",
      value: true,
    },
    {
      label: "Dito mengerjakan soal TOBK",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Dito does not work on TOBK questions even though working on conditional empathy questions",
      value: false,
    },
    {
      label:
        "Dito works on TOBK questions but does not work on conditional empathy questions",
      value: false,
    },
    {
      label: "Dito is not a Nakafa student",
      value: false,
    },
    {
      label: "Dito does not work on conditional empathy questions",
      value: true,
    },
    {
      label: "Dito works on TOBK questions",
      value: false,
    },
  ],
};

export default choices;
