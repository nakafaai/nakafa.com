import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Pegawai yang berpeluang mendapatkan promosi jabatan adalah bukan yang bergaji tinggi.",
      value: false,
    },
    {
      label:
        "Pegawai yang berpeluang memperoleh gaji tinggi adalah yang berpeluang mendapatkan promosi jabatan.",
      value: true,
    },
    {
      label:
        "Pegawai yang berpeluang memperoleh gaji tinggi adalah bukan yang berpeluang mendapatkan promosi jabatan.",
      value: false,
    },
    {
      label:
        "Pegawai yang berpeluang memperoleh gaji tinggi tidak berpeluang mendapatkan promosi jabatan.",
      value: false,
    },
    {
      label:
        "Pegawai yang tidak berpeluang mendapatkan promosi jabatan adalah yang berpeluang memperoleh gaji tinggi.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Employees who have a chance of getting a promotion are not those with high salaries.",
      value: false,
    },
    {
      label:
        "Employees who have a chance of getting a high salary are those who have a chance of getting a promotion.",
      value: true,
    },
    {
      label:
        "Employees who have a chance of getting a high salary are not those who have a chance of getting a promotion.",
      value: false,
    },
    {
      label:
        "Employees who have a chance of getting a high salary do not have a chance of getting a promotion.",
      value: false,
    },
    {
      label:
        "Employees who do not have a chance of getting a promotion are those who have a chance of getting a high salary.",
      value: false,
    },
  ],
};

export default choices;
