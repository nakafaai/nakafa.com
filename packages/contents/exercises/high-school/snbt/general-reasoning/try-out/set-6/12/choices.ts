import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Faktor yang memengaruhi tingkat kemiskinan, seperti upah riil buruh tani dan nilai tukar petani mengalami peningkatan yang signifikan.",
      value: false,
    },
    {
      label:
        "Upah riil buruh tani dan nilai tukar petani tidak mengalami kenaikan.",
      value: false,
    },
    {
      label:
        "Kemiskinan yang terjadi di desa-desa dan ketimpangan antara desa serta kota akan berkurang.",
      value: false,
    },
    {
      label:
        "Kemiskinan banyak terjadi di desa-desa dan ketimpangan antara desa serta kota masih berlanjut.",
      value: false,
    },
    {
      label:
        "Kemiskinan dan ketimpangan antara desa dengan kota sangat tinggi.",
      value: true,
    },
  ],
  en: [
    {
      label:
        "Factors influencing poverty levels, such as real wages of farm laborers and farmers' exchange rates, experienced a significant increase.",
      value: false,
    },
    {
      label:
        "Real wages of farm laborers and farmers' exchange rates did not increase.",
      value: false,
    },
    {
      label:
        "Poverty occurring in villages and inequality between villages and cities will decrease.",
      value: false,
    },
    {
      label:
        "Poverty is rife in villages and inequality between villages and cities continues.",
      value: false,
    },
    {
      label:
        "Poverty and inequality between villages and cities are very high.",
      value: true,
    },
  ],
};

export default choices;
