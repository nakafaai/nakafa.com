import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Direktur batal melakukan program baru pada tahun ini",
      value: false,
    },
    {
      label:
        "Direktur menunda pelaksanaan program baru hingga perizinan selesai",
      value: false,
    },
    {
      label: "PT Batik tidak jadi menjual produk baru pada tahun ini",
      value: false,
    },
    {
      label:
        "PT Batik tidak jadi melaksanakan program tahun ini karena perizinan tidak selesai",
      value: false,
    },
    { label: "PT Batik menjual produk baru tahun ini", value: true },
  ],
  en: [
    { label: "The Director canceled the new program this year", value: false },
    {
      label:
        "The Director postponed the new program implementation until licensing is complete",
      value: false,
    },
    { label: "PT Batik did not sell the new product this year", value: false },
    {
      label:
        "PT Batik did not implement the program this year because licensing was not completed",
      value: false,
    },
    { label: "PT Batik sells the new product this year", value: true },
  ],
};

export default choices;
