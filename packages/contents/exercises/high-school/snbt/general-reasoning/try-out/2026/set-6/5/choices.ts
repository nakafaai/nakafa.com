import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Peminat bola basket semakin meningkat setiap tahunnya",
      value: false,
    },
    {
      label:
        "Seni tari memiliki prospek paling baik karena peminatnya selalu meningkat",
      value: false,
    },
    {
      label:
        "Seni lukis memiliki prospek paling baik karena peminatnya selalu meningkat",
      value: false,
    },
    {
      label:
        "Di setiap jenjang kelas, menyanyi menjadi kegemaran yang paling sedikit peminatnya",
      value: false,
    },
    {
      label:
        "Seni peran paling tidak diminati siswa karena pesertanya selalu paling sedikit pada setiap jenjangnya",
      value: true,
    },
  ],
  en: [
    {
      label: "Interest in basketball is increasing every year",
      value: false,
    },
    {
      label:
        "Dance has the best prospects because interest in it is always increasing",
      value: false,
    },
    {
      label:
        "Painting has the best prospects because interest in it is always increasing",
      value: false,
    },
    {
      label: "In every grade level, singing is the least popular hobby",
      value: false,
    },
    {
      label:
        "Acting is the least popular among students because it always has the fewest participants at every level",
      value: true,
    },
  ],
};

export default choices;
