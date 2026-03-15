import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Siswa yang melanjutkan ke jenjang pendidikan tinggi adalah siswa yang termasuk ke dalam siswa putus sekolah.",
      value: true,
    },
    {
      label:
        "Siswa yang melanjutkan ke jenjang pendidikan tinggi tidak termasuk ke dalam siswa yang putus sekolah.",
      value: false,
    },
    {
      label:
        "Orang yang hidup lebih sejahtera biasanya termasuk ke dalam siswa yang melanjutkan pendidikan tinggi di universitas.",
      value: false,
    },
    {
      label:
        "Siswa yang putus sekolah sebelum lulus tidak melanjutkan ke jenjang pendidikan tinggi di universitas.",
      value: false,
    },
    {
      label:
        "Jika siswa yang putus sekolah semakin meningkat, maka siswa yang masuk pendidikan tinggi semakin menurun.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Students who continue to higher education are students who belong to the dropout category.",
      value: true,
    },
    {
      label:
        "Students who continue to higher education do not belong to the dropout category.",
      value: false,
    },
    {
      label:
        "People who live more prosperously usually belong to the students who continue to higher education at universities.",
      value: false,
    },
    {
      label:
        "Students who drop out before graduating do not continue to higher education at universities.",
      value: false,
    },
    {
      label:
        "If the number of students dropping out increases, then the number of students entering higher education decreases.",
      value: false,
    },
  ],
};

export default choices;
