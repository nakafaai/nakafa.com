import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Jika saat ini sedang tidak musim kemarau maka tumbuh-tumbuhan tidak akan meranggas",
      value: false,
    },
    {
      label:
        "Jika saat ini sedang tidak musim kemarau maka tumbuh-tumbuhan akan meranggas",
      value: false,
    },
    {
      label:
        "Jika saat ini tidak banyak sampah daun maka sekarang sedang musim kemarau",
      value: false,
    },
    {
      label:
        "Jika saat ini sedang musim kemarau maka bisa saja banyak sampah daun berserakan",
      value: false,
    },
    {
      label:
        "Jika saat ini sedang musim kemarau maka banyak sampah daun berserakan",
      value: true,
    },
  ],
  en: [
    {
      label:
        "If it is currently not the dry season, then plants will not shed their leaves",
      value: false,
    },
    {
      label:
        "If it is currently not the dry season, then plants will shed their leaves",
      value: false,
    },
    {
      label:
        "If there is currently not much scattered leaf litter, then it is currently the dry season",
      value: false,
    },
    {
      label:
        "If it is currently the dry season, then there might be a lot of scattered leaf litter",
      value: false,
    },
    {
      label:
        "If it is currently the dry season, then there is a lot of scattered leaf litter",
      value: true,
    },
  ],
};

export default choices;
