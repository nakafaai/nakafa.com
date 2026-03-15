import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Saat musim hujan potensi penyakit menular akibat genangan air semakin tinggi.",
      value: false,
    },
    {
      label: "Hepatitis A dan kolera banyak menular saat sedang musim hujan.",
      value: false,
    },
    {
      label:
        "Penyakit menular seperti hepatitis A dan kolera tidak ditularkan selain melalui air.",
      value: false,
    },
    {
      label:
        "Semakin banyak genangan yang terbentuk setelah banjir surut potensi penyakit malaria semakin rendah.",
      value: true,
    },
    {
      label:
        "Penyakit menular akan semakin masif persebarannya saat sedang musim hujan.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "During the rainy season, the potential for infectious diseases due to stagnant water increases.",
      value: false,
    },
    {
      label:
        "Hepatitis A and cholera are widely transmitted during the rainy season.",
      value: false,
    },
    {
      label:
        "Infectious diseases like hepatitis A and cholera are not transmitted other than through water.",
      value: false,
    },
    {
      label:
        "The more stagnant water pools formed after the flood recedes, the lower the potential for malaria.",
      value: true,
    },
    {
      label:
        "The spread of infectious diseases will be more massive during the rainy season.",
      value: false,
    },
  ],
};

export default choices;
