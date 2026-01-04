import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Musim tanam petani atau musim rendeng menjadi tidak menentu serta petani kekurangan bibit dan pupuk",
      value: false,
    },
    {
      label:
        "Realisasi pengadaan beras semakin tidak optimal dan pemerintah terpaksa melakukan impor beras",
      value: false,
    },
    {
      label:
        "Stok beras pemerintah atau CBP (cadangan beras pemerintah) akan terancam berkurang",
      value: true,
    },
    {
      label:
        "Mekanisme penyaluran pangan untuk raskin atau rastra mengalami perubahan menjadi transfer langsung",
      value: false,
    },
    {
      label:
        "HPP (harga pembelian pemerintah) menjadi semakin rendah dibandingkan dengan harga di pasar",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Farmers' planting season or rendeng season becomes uncertain and farmers lack seeds and fertilizer",
      value: false,
    },
    {
      label:
        "Realization of rice procurement becomes increasingly suboptimal and the government is forced to import rice",
      value: false,
    },
    {
      label:
        "Government rice stocks or CBP (government rice reserves) will be threatened to decrease",
      value: true,
    },
    {
      label:
        "The food distribution mechanism for Raskin or Rastra undergoes a change to direct transfers",
      value: false,
    },
    {
      label:
        "HPP (Government Purchase Price) becomes increasingly lower compared to market prices",
      value: false,
    },
  ],
};

export default choices;
