import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Semua penduduk Desa Nelayan membuat pakan organik dan pakan anorganik",
      value: false,
    },
    {
      label:
        "Semua penduduk Desa Nelayan membuat pakan ikan organik atau pakan ikan anorganik",
      value: true,
    },
    {
      label: "Semua penduduk Desa Nelayan tidak memiliki lahan budi daya",
      value: false,
    },
    {
      label: "Semua penduduk Desa Nelayan memiliki lahan budi daya",
      value: false,
    },
    {
      label:
        "Sebagian penduduk Desa Nelayan yang membudidaya ikan tidak memiliki pakan anorganik",
      value: false,
    },
  ],
  en: [
    {
      label:
        "All residents of Nelayan Village make organic feed and inorganic feed",
      value: false,
    },
    {
      label:
        "All residents of Nelayan Village make organic fish feed or inorganic fish feed",
      value: true,
    },
    {
      label: "All residents of Nelayan Village do not have cultivation land",
      value: false,
    },
    {
      label: "All residents of Nelayan Village have cultivation land",
      value: false,
    },
    {
      label:
        "Some residents of Nelayan Village who farm fish do not have inorganic feed",
      value: false,
    },
  ],
};

export default choices;
