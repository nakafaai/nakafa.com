import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Perubahan iklim telah merubah produk pangan dan berdampak pada kesehatan manusia",
      value: false,
    },
    {
      label:
        "Peningkatan karbon dioksida di atmosfer berdampak pada penurunan hasil pertanian",
      value: false,
    },
    {
      label:
        "Daerah-daerah tropis memiliki produksi pangan yang tinggi dibanding daerah lainnya",
      value: false,
    },
    {
      label:
        "Jika tidak terjadi perubahan iklim maka tidak berdampak pada perubahan produksi pangan atau kesehatan manusia",
      value: true,
    },
    {
      label:
        "Kenaikan suhu dan perubahan pola curah hujan berdampak pada penurunan hasil produksi jagung, padi, dan gandum",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Climate change has altered food products and impacted human health",
      value: false,
    },
    {
      label:
        "Increased carbon dioxide in the atmosphere impacts the decline in agricultural yields",
      value: false,
    },
    {
      label:
        "Tropical regions have high food production compared to other regions",
      value: false,
    },
    {
      label:
        "If climate change does not occur, then there is no impact on changes in food production or human health",
      value: true,
    },
    {
      label:
        "Temperature increases and changes in rainfall patterns impact the decline in corn, rice, and wheat production",
      value: false,
    },
  ],
};

export default choices;
