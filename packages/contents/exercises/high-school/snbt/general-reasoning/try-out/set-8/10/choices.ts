import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Banjir di wilayah Arab semakin luas",
      value: false,
    },
    {
      label: "Tanah di wilayah Arab akan tetap kering",
      value: false,
    },
    {
      label: "Tidak akan terjadi banjir besar di wilayah Arab",
      value: false,
    },
    {
      label: "Tidak akan muncul vegetasi hijau di wilayah Arab",
      value: false,
    },
    {
      label: "Tidak dapat disimpulkan",
      value: true,
    },
  ],
  en: [
    {
      label: "Floods in the Arabian region are getting wider",
      value: false,
    },
    {
      label: "The soil in the Arabian region will remain dry",
      value: false,
    },
    {
      label: "There will be no major floods in the Arabian region",
      value: false,
    },
    {
      label: "Green vegetation will not appear in the Arabian region",
      value: false,
    },
    {
      label: "Cannot be concluded",
      value: true,
    },
  ],
};

export default choices;
