import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Radikal bebas menumbuhkan sel kanker", value: false },
    { label: "Definisi ilmiah tentang buah Matoa", value: false },
    { label: "Pohon Matoa tidak berbuah setiap tahunnya", value: false },
    { label: "Buah Matoa memiliki banyak khasiat", value: true },
    { label: "Buah Matoa tidak menyerupai buah apapun", value: false },
  ],
  en: [
    { label: "Free radicals grow cancer cells", value: false },
    { label: "Scientific definition of Matoa fruit", value: false },
    { label: "Matoa trees do not bear fruit every year", value: false },
    { label: "Matoa fruit has many benefits", value: true },
    { label: "Matoa fruit does not resemble any fruit", value: false },
  ],
};

export default choices;
