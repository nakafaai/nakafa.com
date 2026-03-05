import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "meyakinkan pemerintah untuk memperhatikan dealer.",
      value: false,
    },
    {
      label: "memaparkan keadaan bisnis mobil di masa pandemi Covid-19.",
      value: true,
    },
    {
      label: "menginformasikan jumlah mobil di masa pandemi.",
      value: false,
    },
    {
      label: "menunjukkan data peningkatan penjualan mobil.",
      value: false,
    },
    {
      label: "menyampaikan pendapat masyarakat mengenai bisnis.",
      value: false,
    },
  ],
  en: [
    {
      label: "convince the government to pay attention to dealers.",
      value: false,
    },
    {
      label:
        "explain the condition of the car business during the Covid-19 pandemic.",
      value: true,
    },
    {
      label: "inform the number of cars during the pandemic.",
      value: false,
    },
    {
      label: "show data on the increase in car sales.",
      value: false,
    },
    {
      label: "convey public opinion regarding business.",
      value: false,
    },
  ],
};

export default choices;
