import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Rumah karyawan jauh dari perusahaan", value: false },
    { label: "Karyawan diperhatikan oleh perusahaan", value: true },
    { label: "Keluarga karyawan jauh dari perusahaan", value: false },
    {
      label:
        "Karyawan diberikan tambahan insentif transportasi oleh perusahaan",
      value: false,
    },
    {
      label: "Karyawan mendapatkan ongkos transportasi dari perusahaan",
      value: false,
    },
  ],
  en: [
    { label: "Employee homes are far from the company", value: false },
    { label: "Employees are cared for by the company", value: true },
    { label: "Employee families are far from the company", value: false },
    {
      label:
        "Employees are given additional transport incentives by the company",
      value: false,
    },
    { label: "Employees get transport fare from the company", value: false },
  ],
};

export default choices;
