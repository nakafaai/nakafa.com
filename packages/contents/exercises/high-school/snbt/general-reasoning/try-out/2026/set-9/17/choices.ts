import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Sedimen dan nutrisi dari dataran banjir berdampak positif bagi tanaman.",
      value: false,
    },
    {
      label:
        "Sungai Nil yang mengalami banjir musiman membantuk menyediakan lahan subur.",
      value: false,
    },
    {
      label:
        "Banjir yang terjadi secara musiman bisa meningkatkan produktivitas ekosistem.",
      value: false,
    },
    {
      label:
        "Kesuburan lahan pertanian di delta Sungai Nil tidak dipengaruhi oleh banjir musiman.",
      value: true,
    },
    {
      label:
        "Kualitas tanah di sekitar dataran banjir dipengaruhi oleh sedimen pasca surutnya air banjir.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Sediment and nutrients from the floodplain have a positive impact on plants.",
      value: false,
    },
    {
      label:
        "The Nile River, which floods seasonally, helps provide fertile land.",
      value: false,
    },
    {
      label: "Seasonal floods can increase ecosystem productivity.",
      value: false,
    },
    {
      label:
        "The fertility of agricultural land in the Nile River delta is not affected by seasonal floods.",
      value: true,
    },
    {
      label:
        "Soil quality around the floodplain is affected by sediment after floodwaters recede.",
      value: false,
    },
  ],
};

export default choices;
