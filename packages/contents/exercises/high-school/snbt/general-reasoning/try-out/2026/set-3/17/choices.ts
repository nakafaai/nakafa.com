import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Pekerja muda akan tetap memilih kostan dengan jarak terdekat.",
      value: false,
    },
    {
      label:
        "Jarak terdekat dan biaya murah itu dapat meningkatkan banyak calon penghuni kos.",
      value: false,
    },
    {
      label: "Pekerja muda memilih tempat kos jauh dengan alasan hemat biaya.",
      value: true,
    },
    {
      label: "Pekerja muda memilih tempat kos dengan biaya yang murah.",
      value: false,
    },
    {
      label:
        "Tempat kos yang dipilih adalah tempat kost yang memiliki jarak tempuh terdekat.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Young workers will still choose the boarding house with the closest distance.",
      value: false,
    },
    {
      label:
        "Closest distance and cheap cost can increase many prospective boarding house residents.",
      value: false,
    },
    {
      label:
        "Young workers choose a distant boarding house for the reason of saving costs.",
      value: true,
    },
    {
      label: "Young workers choose a boarding house with cheap costs.",
      value: false,
    },
    {
      label:
        "The chosen boarding house is the one with the closest travel distance.",
      value: false,
    },
  ],
};

export default choices;
