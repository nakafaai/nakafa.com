import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Jika tidak terjadi kenaikan suhu lautan maka ikan-ikan di tropis tidak bergerak kearah kutub mencari tempat dingin",
      value: false,
    },
    {
      label:
        "Jika ikan-ikan di tropis tidak bergerak kearah kutub mencari tempat yang lebih dingin maka tidak terjadi kenaikan suhu lautan",
      value: true,
    },
    {
      label:
        "Jika ikan-ikan di tropis bergerak kearah kutub mencari tempat yang lebih dingin maka terjadi kenaikan suhu lautan",
      value: false,
    },
    {
      label:
        "Penurunan produksi pangan tidak mempengaruhi pertumbuhan populasi manusia 50 tahun ke depan",
      value: false,
    },
    {
      label:
        "Populasi manusia dalam 50 tahun ke depan sangat dipengaruhi oleh penurunan produksi pangan",
      value: false,
    },
  ],
  en: [
    {
      label:
        "If there is no rise in ocean temperature then fish in the tropics do not move towards the poles to find a cool place",
      value: false,
    },
    {
      label:
        "If fish in the tropics do not move towards the poles to find a cooler place then there is no rise in ocean temperature",
      value: true,
    },
    {
      label:
        "If fish in the tropics move towards the poles to find a cooler place then there is a rise in ocean temperature",
      value: false,
    },
    {
      label:
        "The decline in food production does not affect human population growth in the next 50 years",
      value: false,
    },
    {
      label:
        "Human population in the next 50 years is strongly influenced by the decline in food production",
      value: false,
    },
  ],
};

export default choices;
