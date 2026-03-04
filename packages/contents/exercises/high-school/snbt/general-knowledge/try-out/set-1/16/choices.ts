import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Kayu-kayu balok itu *terikat* dengan kuat.",
      value: true,
    },
    {
      label: "Kakinya *terinjak* saat menonton konser semalam.",
      value: false,
    },
    {
      label: "Arman menjadi siswa *terbaik* di kelas.",
      value: false,
    },
    {
      label: "Dia *tertidur* di sofa semalam.",
      value: false,
    },
    {
      label: "Dian menjadi peserta *termuda* dalam acara tersebut.",
      value: false,
    },
  ],
  en: [
    {
      label: "The wooden logs are tightly *tied*.",
      value: true,
    },
    {
      label: "His foot was *stepped on* while watching the concert last night.",
      value: false,
    },
    {
      label: "Arman became the *best* student in the class.",
      value: false,
    },
    {
      label: "He *fell asleep* on the sofa last night.",
      value: false,
    },
    {
      label: "Dian became the *youngest* participant in the event.",
      value: false,
    },
  ],
};

export default choices;
