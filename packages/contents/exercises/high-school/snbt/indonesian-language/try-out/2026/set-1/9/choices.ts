import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Keseluruhan sampah plastik yang ada di Indonesia",
      value: false,
    },
    {
      label: "Plastik yang masuk ke laut dari sungai atau langsung dari pantai",
      value: true,
    },
    {
      label: "Sampah yang sampai ke daratan suatu wilayah tertentu",
      value: false,
    },
    {
      label: "Seluruh sampah yang nonorganik",
      value: false,
    },
    {
      label: "Sampah yang proses penguraiannya sulit",
      value: false,
    },
  ],
  en: [
    {
      label: "Keseluruhan sampah plastik yang ada di Indonesia",
      value: false,
    },
    {
      label: "Plastik yang masuk ke laut dari sungai atau langsung dari pantai",
      value: true,
    },
    {
      label: "Sampah yang sampai ke daratan suatu wilayah tertentu",
      value: false,
    },
    {
      label: "Seluruh sampah yang nonorganik",
      value: false,
    },
    {
      label: "Sampah yang proses penguraiannya sulit",
      value: false,
    },
  ],
};

export default choices;
