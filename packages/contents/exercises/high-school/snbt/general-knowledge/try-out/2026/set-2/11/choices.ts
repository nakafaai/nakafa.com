import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "susu yang tidak mengandung unsur gula.",
      value: false,
    },
    {
      label: "susu yang dikhususkan untuk para manula.",
      value: false,
    },
    {
      label: "minuman khas untuk penyakit tertentu.",
      value: false,
    },
    {
      label: "susu yang sudah mengalami peragian.",
      value: true,
    },
    {
      label: "pencampuran susu dengan unsur oksigen.",
      value: false,
    },
  ],
  en: [
    {
      label: "milk that does not contain sugar elements.",
      value: false,
    },
    {
      label: "milk specifically for the elderly.",
      value: false,
    },
    {
      label: "a typical drink for certain diseases.",
      value: false,
    },
    {
      label: "milk that has undergone fermentation.",
      value: true,
    },
    {
      label: "mixing milk with oxygen elements.",
      value: false,
    },
  ],
};

export default choices;
