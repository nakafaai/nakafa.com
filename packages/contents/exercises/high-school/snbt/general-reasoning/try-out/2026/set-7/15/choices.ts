import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Pembentukan batu ginjal sebagian besar disebabkan karena konsumsi tomat.",
      value: false,
    },
    {
      label:
        "Walaupun tomat berpotensi menyebabkan batu ginjal, tomat juga dapat memperburuk pencernaan.",
      value: false,
    },
    {
      label:
        "Kandungan asam oksalat pada tomat berpotensi meningkatkan kadar gula darah.",
      value: false,
    },
    {
      label: "Mengonsumsi tomat dapat membuat seseorang terhindar dari kanker.",
      value: true,
    },
    {
      label:
        "Buah tomat banyak dikonsumsi karena memiliki kalori yang relatif rendah.",
      value: false,
    },
  ],
  en: [
    {
      label: "Kidney stone formation is largely caused by tomato consumption.",
      value: false,
    },
    {
      label:
        "Although tomatoes potentially cause kidney stones, they can also worsen digestion.",
      value: false,
    },
    {
      label:
        "The oxalate acid content in tomatoes potentially increases blood sugar levels.",
      value: false,
    },
    { label: "Consuming tomatoes can help someone avoid cancer.", value: true },
    {
      label:
        "Tomatoes are widely consumed because they have relatively low calories.",
      value: false,
    },
  ],
};

export default choices;
