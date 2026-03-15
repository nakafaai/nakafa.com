import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Pada hari Minggu tidak jadi dilaksanakan kerja bakti karena turun hujan.",
      value: false,
    },
    {
      label:
        "Pada hari Minggu dilaksanakan kerja bakti mengumpulkan barang bekas.",
      value: true,
    },
    {
      label:
        "Pada hari Minggu dilaksanakan kerja bakti membersihkan selokan dan mengumpulkan barang bekas.",
      value: false,
    },
    {
      label:
        "Pada Hari minggu kerja bakti mengumpulkan barang bekas dan membersihkan selokan tidak dilaksanakan.",
      value: false,
    },
    {
      label:
        "Pada hari minggu kerja bakti tidak dilaksanakan karena turun hujan.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "On Sunday, the community service was cancelled because of the rain.",
      value: false,
    },
    {
      label:
        "On Sunday, community service to collect used goods was carried out.",
      value: true,
    },
    {
      label:
        "On Sunday, community service to clean gutters and collect used goods was carried out.",
      value: false,
    },
    {
      label:
        "On Sunday, community service to collect used goods was carried out, and cleaning gutters was not carried out.",
      value: false,
    },
    {
      label:
        "On Sunday, community service was not carried out because of the rain.",
      value: false,
    },
  ],
};

export default choices;
