import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Kegemaran basket adalah paling banyak diminati",
      value: false,
    },
    {
      label: "Jumlah siswa gemar seni peran adalah 65 siswa",
      value: false,
    },
    {
      label: "Jumlah siswa kelas XII sesuai kegemaran adalah 306",
      value: false,
    },
    {
      label: "Kegemaran seni tari yang paling sedikit ada di kelas X",
      value: false,
    },
    {
      label: "Jumlah siswa gemar melukis adalah 160",
      value: true,
    },
  ],
  en: [
    {
      label: "Basketball is the most popular hobby",
      value: false,
    },
    {
      label: "The number of students who like acting is 65",
      value: false,
    },
    {
      label: "The total number of Grade XII students based on hobbies is 306",
      value: false,
    },
    {
      label: "The lowest interest in dance is in Grade X",
      value: false,
    },
    {
      label: "The number of students who like painting is 160",
      value: true,
    },
  ],
};

export default choices;
