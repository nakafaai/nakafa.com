import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Tidak mengalami delirium atau terinfeksi Covid-19.",
      value: false,
    },
    {
      label:
        "Mengalami perubahan kesadaran akut terjadi secara fluktuatif dan tidak terinfeksi Covid-19.",
      value: true,
    },
    {
      label: "Beberapa pasien Covid-19 mengalami gejala delirium.",
      value: false,
    },
    {
      label:
        "Penderita delirium mengalami perburukan dari suatu medis seseorang.",
      value: false,
    },
    {
      label: "Beberapa pasien Covid-19 tidak mengalami gejala delirium.",
      value: false,
    },
  ],
  en: [
    {
      label: "Not experiencing delirium or infected with Covid-19.",
      value: false,
    },
    {
      label:
        "Experiencing acute fluctuating changes in consciousness and not infected with Covid-19.",
      value: true,
    },
    {
      label: "Some Covid-19 patients experience delirium symptoms.",
      value: false,
    },
    {
      label:
        "Delirium sufferers experience deterioration of a person's medical condition.",
      value: false,
    },
    {
      label: "Some Covid-19 patients do not experience delirium symptoms.",
      value: false,
    },
  ],
};

export default choices;
