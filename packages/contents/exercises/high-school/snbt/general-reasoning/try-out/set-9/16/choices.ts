import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Nitrogen dan fosfor adalah nutrisi yang dapat membahayakan tanah di lingkungan.",
      value: false,
    },
    {
      label: "Bahan organic hanya bisa didapat ketika banjir musiman terjadi.",
      value: false,
    },
    {
      label:
        "Banjir yang terjadi musiman banyak mengangkut nutrisi penting bagi tanah sekitarnya.",
      value: true,
    },
    {
      label:
        "Tanah sangat membutuhkan banjir musiman baik yang secara alami maupun karena ulah manusia.",
      value: false,
    },
    {
      label: "Kesuburan tanah hanya bisa didapat saat musim banjir tiba.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Nitrogen and phosphorus are nutrients that can harm soil in the environment.",
      value: false,
    },
    {
      label: "Organic matter can only be obtained when seasonal floods occur.",
      value: false,
    },
    {
      label:
        "Seasonal floods transport many important nutrients to the surrounding soil.",
      value: true,
    },
    {
      label: "Soil greatly needs seasonal floods, whether natural or man-made.",
      value: false,
    },
    {
      label:
        "Soil fertility can only be obtained when the flood season arrives.",
      value: false,
    },
  ],
};

export default choices;
