import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

export const choices: ExercisesChoices = {
  id: [
    {
      label: "Masa tanam dan masa panen sulit untuk direncanakan petani.",
      value: false,
    },
    {
      label: "Produktivitas pertanian negeri terancam mengalami kegagalan.",
      value: false,
    },
    {
      label: "Musim kemarau yang terlalu panjang dan banjir di musim hujan.",
      value: true,
    },
    {
      label: "Sumber-sumber penyakit baru pada tanaman dan angin kencang.",
      value: false,
    },
    {
      label: "Badai yang merusak tanaman sehingga merugikan para petani.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Planting and harvesting periods being difficult for farmers to plan.",
      value: false,
    },
    {
      label:
        "The country's agricultural productivity being threatened with failure.",
      value: false,
    },
    {
      label: "Excessively long dry seasons and floods during the rainy season.",
      value: true,
    },
    {
      label: "New sources of plant diseases and strong winds.",
      value: false,
    },
    {
      label: "Storms that destroy crops, causing losses to farmers.",
      value: false,
    },
  ],
};

export default choices;
