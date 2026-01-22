import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Tidak ada warga Kampung Bambu yang mengalami tindak kejahatan pada hari minggu yang lalu",
      value: false,
    },
    {
      label:
        "Tidak ada warga Kampung Bambu yang mengalami pencurian pada hari minggu yang lalu",
      value: false,
    },
    {
      label:
        "Pada hari minggu yang lalu, di Kampung Bambu baru saja terjadi tindak kejahatan berupa pencurian",
      value: true,
    },
    {
      label:
        "Di Kampung Bambu tidak terjadi tindak kejahatan pada hari minggu lalu karena keamanan kampung ditingkatkan",
      value: false,
    },
    {
      label:
        "Sejak hari minggu yang lalu di Kampung Bambu tidak terjadi tindak kejahatan",
      value: false,
    },
  ],
  en: [
    {
      label: "No resident of Kampung Bambu experienced a crime last Sunday",
      value: false,
    },
    {
      label: "No resident of Kampung Bambu experienced theft last Sunday",
      value: false,
    },
    {
      label:
        "Last Sunday, a crime in the form of theft just occurred in Kampung Bambu",
      value: true,
    },
    {
      label:
        "No crime occurred in Kampung Bambu last Sunday because village security was improved",
      value: false,
    },
    {
      label: "Since last Sunday, no crime has occurred in Kampung Bambu",
      value: false,
    },
  ],
};

export default choices;
