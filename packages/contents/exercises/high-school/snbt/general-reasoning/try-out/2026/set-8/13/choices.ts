import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Mengonsumsi sayur dan buah yang mengandung antioksidan mampu menangkal efek radikal bebas",
      value: false,
    },
    {
      label:
        "Jika tidak ingin mengalami penuaan dini alangkah baiknya mengonsumsi buah nanas",
      value: false,
    },
    {
      label:
        "Pola makan sehat dapat dilakukan dengan mengonsumsi buah dan sayur serta olahraga teratur",
      value: false,
    },
    {
      label:
        "Seseorang yang mengonsumsi nanas berpotensi terhindar dari penuaan dini",
      value: false,
    },
    {
      label:
        "Seseorang yang mengonsumsi sayur dan buah dapat berpotensi untuk terkena penyakit kronis",
      value: true,
    },
  ],
  en: [
    {
      label:
        "Consuming vegetables and fruits containing antioxidants can counteract the effects of free radicals",
      value: false,
    },
    {
      label:
        "If one does not want to experience premature aging, it is good to consume pineapples",
      value: false,
    },
    {
      label:
        "A healthy diet can be achieved by consuming fruits and vegetables and exercising regularly",
      value: false,
    },
    {
      label:
        "Someone who consumes pineapples has the potential to avoid premature aging",
      value: false,
    },
    {
      label:
        "Someone who consumes vegetables and fruits has the potential to develop chronic diseases",
      value: true,
    },
  ],
};

export default choices;
