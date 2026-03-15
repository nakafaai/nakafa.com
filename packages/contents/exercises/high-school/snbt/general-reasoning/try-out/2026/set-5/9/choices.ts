import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Adanya sumber energi atau kita tidak akan bisa melakukan seluruh aktivitas yang biasa dilakukan",
      value: false,
    },
    {
      label:
        "Jika listrik terus menerus digunakan tanpa batasan wajar maka akan habis",
      value: false,
    },
    {
      label:
        "Jika listrik rumah tidak terputus maka terjadi pemakaian dalam jumlah yang tidak melebihi batasan wajar",
      value: false,
    },
    {
      label:
        "Pemakaian dalam jumlah melebihi batasan wajar dan listrik rumah tidak akan terputus",
      value: true,
    },
    {
      label:
        "Pemakaian dalam jumlah tidak melebihi batasan wajar atau listrik rumah akan terputus",
      value: false,
    },
  ],
  en: [
    {
      label:
        "There are energy sources or we will not be able to carry out all usual activities",
      value: false,
    },
    {
      label:
        "If electricity is used continuously without reasonable limits then it will run out",
      value: false,
    },
    {
      label:
        "If the house electricity is not cut off then consumption occurred in an amount that did not exceed reasonable limits",
      value: false,
    },
    {
      label:
        "Consumption exceeds reasonable limits and house electricity will not be cut off",
      value: true,
    },
    {
      label:
        "Consumption does not exceed reasonable limits or house electricity will be cut off",
      value: false,
    },
  ],
};

export default choices;
