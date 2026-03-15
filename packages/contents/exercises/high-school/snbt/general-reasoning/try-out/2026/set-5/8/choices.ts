import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Semua warga Jakarta memiliki AKTA kelahiran dan KTP",
      value: false,
    },
    {
      label: "Semua warga Jakarta memiliki AKTA kelahiran atau KTP",
      value: false,
    },
    {
      label:
        "Ada warga Jakarta di atas $$17$$ tahun tidak memiliki AKTA kelahiran namun memiliki KTP",
      value: false,
    },
    {
      label: "Sebagian warga Jakarta memiliki AKTA kelahiran dan KTP",
      value: true,
    },
    {
      label:
        "Sebagian warga Jakarta tidak memiliki AKTA kelahiran namun mempunyai KTP",
      value: false,
    },
  ],
  en: [
    {
      label: "All Jakarta residents have a birth certificate and ID card (KTP)",
      value: false,
    },
    {
      label: "All Jakarta residents have a birth certificate or ID card (KTP)",
      value: false,
    },
    {
      label:
        "There are Jakarta residents over 17 years old who do not have a birth certificate but have an ID card (KTP)",
      value: false,
    },
    {
      label:
        "Some Jakarta residents have a birth certificate and ID card (KTP)",
      value: true,
    },
    {
      label:
        "Some Jakarta residents do not have a birth certificate but have an ID card (KTP)",
      value: false,
    },
  ],
};

export default choices;
