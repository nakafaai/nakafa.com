import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "mimpi yang dianggap sebagai rasa kurang puas saat kita terjaga sebelumnya.",
      value: false,
    },
    {
      label:
        "pertanyaan dan dugaan sumber datangnya mimpi pada tidur seseorang.",
      value: true,
    },
    {
      label: "mimpi pada kucing yang umumnya berisi mengejar sesuatu.",
      value: false,
    },
    {
      label:
        "mimpi seseorang tentang hal-hal penting, misalnya, perayaan ulang tahun ataupun kejadian yang akan datang.",
      value: false,
    },
    {
      label:
        "anak-anak dianjurkan untuk tidur agar mereka bisa memimpikan hal yang telah mereka lakukan.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "dreams considered as a sense of dissatisfaction when we were previously awake.",
      value: false,
    },
    {
      label:
        "questions and hypotheses about the source of dreams during someone's sleep.",
      value: true,
    },
    {
      label: "cats' dreams which generally contain chasing something.",
      value: false,
    },
    {
      label:
        "someone's dream about important things, for example, birthdays or upcoming events.",
      value: false,
    },
    {
      label:
        "children are advised to sleep so they can dream about things they have done.",
      value: false,
    },
  ],
};

export default choices;
