import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Penjualan tertinggi untuk semua jenis rempah terjadi pada bulan November 2020.",
      value: false,
    },
    {
      label:
        "Penjualan bawang merah pada bulan Januari 2021 diprediksi sebesar $$76$$ ton.",
      value: false,
    },
    {
      label:
        "Penjualan bawang putih pada bulan Januari 2021 akan melebihi $$100$$ ton.",
      value: true,
    },
    {
      label: "Penjualan bawang merah selalu di bawah penjualan cabai merah.",
      value: false,
    },
    {
      label:
        "Penjualan yang paling kecil terjadi pada penjualan bawang merah tiap bulannya.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "The highest sales for all types of spices occurred in November 2020.",
      value: false,
    },
    {
      label: "Shallot sales in January 2021 are predicted to be $$76$$ tons.",
      value: false,
    },
    {
      label: "Garlic sales in January 2021 will exceed $$100$$ tons.",
      value: true,
    },
    {
      label: "Shallot sales are always below red chili sales.",
      value: false,
    },
    {
      label: "The smallest sales occur in shallot sales every month.",
      value: false,
    },
  ],
};

export default choices;
