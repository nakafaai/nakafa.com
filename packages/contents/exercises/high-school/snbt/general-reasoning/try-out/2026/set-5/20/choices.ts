import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Perusahaan tidak memberi pesangon kepada karyawan",
      value: true,
    },
    {
      label: "Karyawan memilih perusahaan ditutup",
      value: false,
    },
    {
      label: "Sebagian karyawan diberi pesangon",
      value: false,
    },
    {
      label: "Direktur memperhatikan sebagian karyawan",
      value: false,
    },
    {
      label: "Sebagian karyawan tidak mau mengundurkan diri",
      value: false,
    },
  ],
  en: [
    {
      label: "The company does not give severance pay to employees",
      value: true,
    },
    {
      label: "Employees choose for the company to be closed",
      value: false,
    },
    {
      label: "Some employees are given severance pay",
      value: false,
    },
    {
      label: "The director pays attention to some employees",
      value: false,
    },
    {
      label: "Some employees do not want to resign",
      value: false,
    },
  ],
};

export default choices;
