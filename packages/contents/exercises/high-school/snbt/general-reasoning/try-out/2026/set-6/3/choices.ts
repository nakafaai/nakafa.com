import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Pada hari Minggu tidak jadi dilaksanakan kerja bakti karena turun hujan",
      value: false,
    },
    {
      label:
        "Pada hari Minggu dilaksanakan kerja bakti mengumpulkan barang bekas",
      value: true,
    },
    {
      label:
        "Pada hari Minggu dilaksanakan kerja bakti membersihkan selokan dan mengumpulkan barang bekas",
      value: false,
    },
    {
      label:
        "Pada Hari minggu kerja bakti mengumpulkan barang bekas dan membersihkan selokan tidak dilaksanakan",
      value: false,
    },
    {
      label:
        "Pada hari minggu kerja bakti tidak dilaksanakan karena turun hujan",
      value: false,
    },
  ],
  en: [
    {
      label: "Community service is not held on Sunday because it rained",
      value: false,
    },
    {
      label: "Community service to collect used goods is held on Sunday",
      value: true,
    },
    {
      label:
        "Community service to clean gutters and collect used goods is held on Sunday",
      value: false,
    },
    {
      label:
        "Community service to collect used goods is held on Sunday and cleaning gutters is not implemented",
      value: false,
    },
    {
      label: "Community service is not held on Sunday because it rained",
      value: false,
    },
  ],
};

export default choices;
