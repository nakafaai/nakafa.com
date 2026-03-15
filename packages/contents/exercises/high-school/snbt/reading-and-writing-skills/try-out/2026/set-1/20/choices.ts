import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Regulasi Penggunaan Gawai.",
      value: false,
    },
    {
      label: "Pentingnya Pengawasan Orang Tua.",
      value: false,
    },
    {
      label: "Usia Anak Pengguna Gawai.",
      value: true,
    },
    {
      label: "Dampak Penggunaan Gawai.",
      value: false,
    },
    {
      label: "Pengawasan Gawai pada Anak.",
      value: false,
    },
  ],
  en: [
    {
      label: "Gadget Usage Regulations.",
      value: false,
    },
    {
      label: "The Importance of Parental Supervision.",
      value: false,
    },
    {
      label: "The Age of Children Using Gadgets.",
      value: true,
    },
    {
      label: "The Impact of Gadget Usage.",
      value: false,
    },
    {
      label: "Gadget Supervision in Children.",
      value: false,
    },
  ],
};

export default choices;
