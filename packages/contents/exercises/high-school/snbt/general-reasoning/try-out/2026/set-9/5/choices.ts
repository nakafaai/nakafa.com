import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Seseorang yang mengalami permasalahan dengkuran saat tidur dianjurkan melakukan posisi tidur tengkurap",
      value: false,
    },
    {
      label:
        "Seseorang yang sering mengalami nyeri leher tidak disarankan untuk melakukan posisi tidur tengkurap",
      value: false,
    },
    {
      label:
        "Lidah tidak akan menutup jalan napas saat seseorang tidur tengkurap",
      value: false,
    },
    {
      label:
        "Tidur tengkurap hanya memberikan dampak buruk bagi seseorang yang punya permasalahan dengkuran saat tidur",
      value: true,
    },
    {
      label:
        "Posisi tidur tengkurap lebih baik daripada posisi tidur yang lainnya bagi tubuh",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Someone experiencing snoring problems during sleep is advised to sleep in a prone position",
      value: false,
    },
    {
      label:
        "Someone who often experiences neck pain is not advised to sleep in a prone position",
      value: false,
    },
    {
      label:
        "The tongue will not block the airway when someone sleeps in a prone position",
      value: false,
    },
    {
      label:
        "Prone sleeping only has bad impacts for someone who has snoring problems during sleep",
      value: true,
    },
    {
      label:
        "Prone sleeping position is better than other sleeping positions for the body",
      value: false,
    },
  ],
};

export default choices;
