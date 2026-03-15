import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Indonesia sudah mencatat pelanggaran yang terjadi saat PSBB mulai diberlakukan.",
      value: false,
    },
    {
      label:
        "Beberapa daerah di Indonesia sudah memberlakukan PSBB dengan baik dan terarah.",
      value: false,
    },
    {
      label:
        "PSBB mulai diberlakukan di sejumlah daerah di Indonesia akibat lonjakan pasien Covid-19.",
      value: true,
    },
    {
      label:
        "Karena PSBB sudah diberlakukan, banyak pelaku ekonomi yang gulung tikar.",
      value: false,
    },
    {
      label:
        "Indonesia serempak melakukan PSBB untuk mencegah penyebaran Covid-19.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Indonesia has recorded violations that occurred when PSBB began to be implemented.",
      value: false,
    },
    {
      label:
        "Several regions in Indonesia have implemented PSBB properly and systematically.",
      value: false,
    },
    {
      label:
        "PSBB began to be implemented in several regions in Indonesia due to the spike in Covid-19 patients.",
      value: true,
    },
    {
      label:
        "Because PSBB has been implemented, many economic actors have gone bankrupt.",
      value: false,
    },
    {
      label:
        "Indonesia simultaneously implemented PSBB to prevent the spread of Covid-19.",
      value: false,
    },
  ],
};

export default choices;
