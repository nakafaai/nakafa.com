import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

export const choices: ExercisesChoices = {
  id: [
    {
      label: "terdapat kesalahan tanda baca pada kalimat $$ (2) $$.",
      value: false,
    },
    {
      label: "kalimat $$ (1) $$ tidak memiliki subjek yang jelas.",
      value: true,
    },
    {
      label: "konjungsi yang digunakan pada kalimat $$ (3) $$ salah.",
      value: false,
    },
    {
      label: "perlu ditambahkan tanda (,) pada kalimat $$ (4) $$.",
      value: false,
    },
    {
      label: "kalimat $$ (5) $$ mengandung pemborosan kata.",
      value: false,
    },
  ],
  en: [
    {
      label: "there is a punctuation error in sentence $$ (2) $$.",
      value: false,
    },
    {
      label: "sentence $$ (1) $$ does not have a clear subject.",
      value: true,
    },
    {
      label: "the conjunction used in sentence $$ (3) $$ is incorrect.",
      value: false,
    },
    {
      label: "a comma (,) needs to be added in sentence $$ (4) $$.",
      value: false,
    },
    {
      label: "sentence $$ (5) $$ contains wordiness.",
      value: false,
    },
  ],
};

export default choices;
