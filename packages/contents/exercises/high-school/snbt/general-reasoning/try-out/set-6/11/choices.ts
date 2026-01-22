import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Impor BBM mengalami fluktuasi.", value: false },
    {
      label:
        "Produksi, konsumsi, dan impor BBM selalu mengalami kenaikan tiap tahunnya.",
      value: false,
    },
    { label: "Konsumsi BBM tertinggi terjadi pada tahun 2005.", value: false },
    {
      label:
        "Konsumsi BBM selalu lebih tinggi daripada produksi sehingga dilakukan impor.",
      value: true,
    },
    {
      label: "Jumlah impor BBM selalu lebih rendah dari produksi BBM.",
      value: false,
    },
  ],
  en: [
    { label: "Fuel imports fluctuate.", value: false },
    {
      label:
        "Production, consumption, and fuel imports always increase every year.",
      value: false,
    },
    { label: "The highest fuel consumption occurred in 2005.", value: false },
    {
      label:
        "Fuel consumption is always higher than production, so imports are carried out.",
      value: true,
    },
    {
      label: "The amount of fuel imports is always lower than fuel production.",
      value: false,
    },
  ],
};

export default choices;
