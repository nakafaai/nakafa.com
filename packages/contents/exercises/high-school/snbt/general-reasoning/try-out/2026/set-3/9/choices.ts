import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Jika tidak terjadi penambangan pasir ilegal maka DAS rusak.",
      value: false,
    },
    {
      label:
        "Sungai mampu menahan debit air hujan rusak atau terjadi bencana saat musim hujan.",
      value: true,
    },
    {
      label:
        "Ada penambang pasir ilegal dan tidak terjadi bencana saat musim hujan.",
      value: false,
    },
    {
      label:
        "DAS rusak dan terjadinya sedimentasi tapi tidak mengancam masyarakat.",
      value: false,
    },
    {
      label:
        "Jika sungai tertutup sedimentasi limbah tambang maka banyak aliran sungai tidak terputus.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "If illegal sand mining does not occur then the watershed is damaged.",
      value: false,
    },
    {
      label:
        "Rivers are able to withstand rainwater discharge damaged or disaster occurs during the rainy season.",
      value: true,
    },
    {
      label:
        "There are illegal sand miners and no disaster occurs during the rainy season.",
      value: false,
    },
    {
      label:
        "The watershed is damaged and sedimentation occurs but does not threaten the community.",
      value: false,
    },
    {
      label:
        "If the river is covered by mining waste sedimentation then many river flows are not cut off.",
      value: false,
    },
  ],
};

export default choices;
