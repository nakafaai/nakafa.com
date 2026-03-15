import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Kegemaran basket adalah paling banyak diminati",
      value: false,
    },
    {
      label: "Jumlah siswa gemar seni peran adalah $$65$$ siswa",
      value: false,
    },
    {
      label:
        "Jumlah siswa kelas $$\\text{XII}$$ sesuai kegemaran adalah $$468$$",
      value: false,
    },
    {
      label:
        "Kegemaran seni tari yang paling sedikit ada di kelas $$\\text{XI}$$",
      value: false,
    },
    {
      label: "Jumlah siswa gemar melukis adalah $$160$$",
      value: true,
    },
  ],
  en: [
    {
      label: "Basketball is the most popular interest",
      value: false,
    },
    {
      label: "The number of students interested in acting is $$65$$ students",
      value: false,
    },
    {
      label:
        "The number of class $$\\text{XII}$$ students according to interest is $$306$$",
      value: false,
    },
    {
      label: "The least interest in dance is in class $$\\text{X}$$",
      value: false,
    },
    {
      label: "The number of students interested in painting is $$160$$",
      value: true,
    },
  ],
};

export default choices;
