import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Sayuran yang mengandung magnesium dan sedikit glukosa dapat menjaga tumbuh kembang bayi",
      value: false,
    },
    {
      label: "Sayuran adalah asupan gizi yang baik untuk bayi",
      value: false,
    },
    {
      label: "Sayuran dapat dijadikan asupan gizi sebagai pendamping ASI",
      value: false,
    },
    {
      label:
        "Sayuran yang diperlukan oleh bayi adalah yang mengandung magnesium dan sedikit glukosa",
      value: false,
    },
    {
      label:
        "Sayuran dan buah-buahan sebagai asupan gizi anak mampu meningkatkan kesehatan",
      value: true,
    },
  ],
  en: [
    {
      label:
        "Vegetables containing magnesium and low glucose can maintain the baby's growth and development",
      value: false,
    },
    {
      label: "Vegetables are good nutritional intake for babies",
      value: false,
    },
    {
      label:
        "Vegetables can be used as nutritional intake complementary to breast milk (ASI)",
      value: false,
    },
    {
      label:
        "Vegetables needed by babies are those containing magnesium and low glucose",
      value: false,
    },
    {
      label:
        "Vegetables and fruits as child nutritional intake are able to improve health",
      value: true,
    },
  ],
};

export default choices;
