import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Dampak serapan dalam negeri terhadap impor beras adalah berbanding terbalik",
      value: true,
    },
    {
      label:
        "Dampak serapan dalam negeri terhadap impor beras adalah berbanding lurus",
      value: false,
    },
    {
      label:
        "Tidak ada korelasi antara serapan dalam negeri dengan impor beras",
      value: false,
    },
    {
      label:
        "Dampak serapan dalam negeri terhadap ekspor beras adalah berbanding terbalik",
      value: false,
    },
    {
      label:
        "Solusi merevisi Peraturan Presiden Nomor 63 Tahun 2017 akan mengubah alokasi anggaran",
      value: false,
    },
  ],
  en: [
    {
      label:
        "The impact of domestic absorption on rice imports is inversely proportional",
      value: true,
    },
    {
      label:
        "The impact of domestic absorption on rice imports is directly proportional",
      value: false,
    },
    {
      label:
        "There is no correlation between domestic absorption and rice imports",
      value: false,
    },
    {
      label:
        "The impact of domestic absorption on rice exports is inversely proportional",
      value: false,
    },
    {
      label:
        "The solution of revising Presidential Regulation Number 63 of 2017 will change budget allocations",
      value: false,
    },
  ],
};

export default choices;
