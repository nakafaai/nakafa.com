import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Alokasi dana pendidikan meningkat",
      value: false,
    },
    {
      label:
        "Banyak mahasiswa terbaik dapat berkuliah di universitas terbaik dalam negeri",
      value: false,
    },
    {
      label:
        "Beberapa mahasiswa terbaik Indonesia dapat berkuliah di universitas terbaik di luar negeri",
      value: false,
    },
    {
      label: "Alokasi dana pendidikan tidak sepenuhnya terserap",
      value: false,
    },
    {
      label:
        "Banyak mahasiswa terbaik Indonesia dapat berkuliah di universitas terbaik di luar negeri",
      value: true,
    },
  ],
  en: [
    {
      label: "Education fund allocation increases",
      value: false,
    },
    {
      label:
        "Many best students can study at the best universities within the country",
      value: false,
    },
    {
      label:
        "Some of Indonesia's best students can study at the best universities abroad",
      value: false,
    },
    {
      label: "Education fund allocation is not fully absorbed",
      value: false,
    },
    {
      label:
        "Many of Indonesia's best students can study at the best universities abroad",
      value: true,
    },
  ],
};

export default choices;
