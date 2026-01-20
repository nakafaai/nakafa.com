import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Dito mengerjakan soal empati bersyarat", value: false },
    {
      label:
        "Dito mengerjakan soal empati atau mendapatkan hasil evaluasi prestasi belajar",
      value: false,
    },
    {
      label:
        "Dito tidak mendapatkan hasil evaluasi belajar meskipun Dito mengerjakan soal empati bersyarat",
      value: false,
    },
    {
      label: "Dito mendapatkan hasil Evaluasi Prestasi Belajar (EPB)",
      value: true,
    },
    {
      label:
        "Dito mendapatkan hasil Evaluasi Prestasi Belajar (EPB) dan mengerjakan soal empati bersyarat",
      value: false,
    },
  ],
  en: [
    { label: "Dito works on conditional empathy questions", value: false },
    {
      label:
        "Dito works on conditional empathy questions or gets learning achievement evaluation results",
      value: false,
    },
    {
      label:
        "Dito does not get learning achievement evaluation results even though Dito works on conditional empathy questions",
      value: false,
    },
    {
      label: "Dito gets Learning Achievement Evaluation (EPB) results",
      value: true,
    },
    {
      label:
        "Dito gets Learning Achievement Evaluation (EPB) results and works on conditional empathy questions",
      value: false,
    },
  ],
};

export default choices;
