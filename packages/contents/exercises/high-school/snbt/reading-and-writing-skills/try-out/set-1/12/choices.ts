import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Kerusakan lingkungan dapat diartikan sebagai proses deteriorasi atau penurunan mutu lingkungan sehingga ditandai dengan hilangnya sumber daya tanah, air, udara, punahnya flora dan fauna liar, serta rusaknya ekosistem.",
      value: false,
    },
    {
      label:
        "Kerusakan lingkungan dapat diartikan sebagai proses deteriorasi atau penurunan mutu lingkungan yang ditandai dengan hilangnya sumber daya tanah, air, udara, punahnya flora dan fauna liar, serta rusaknya ekosistem.",
      value: true,
    },
    {
      label:
        "Kerusakan lingkungan dapat diartikan sebagai proses deteriorasi atau penurunan mutu lingkungan yang mana ditandai pula oleh hilangnya sumber daya tanah, air, udara, punahnya sumber daya tanah, air, udara, punahnya flora dan fauna liar, dan kerusakan ekosistem.",
      value: false,
    },
    {
      label:
        "Kerusakan lingkungan dapat diartikan sebagai proses deteriorasi atau penurunan mutu lingkungan karena ditandai dengan hilangnya sumber daya tanah, air, udara, punahnya flora dan fauna liar, dan rusaknya ekosistem.",
      value: false,
    },
    {
      label:
        "Kerusakan lingkungan dapat diartikan sebagai proses deteriorasi atau penurunan mutu lingkungan, tetapi juga ditandai dengan hilangnya sumber daya tanah, air, udara, punahnya flora dan fauna liar, serta kerusakan ekosistem.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Environmental damage can be defined as a process of deterioration or decline in environmental quality so that it is characterized by the loss of soil, water, and air resources, the extinction of wild flora and fauna, and ecosystem damage.",
      value: false,
    },
    {
      label:
        "Environmental damage can be defined as a process of deterioration or decline in environmental quality which is characterized by the loss of soil, water, and air resources, the extinction of wild flora and fauna, and ecosystem damage.",
      value: true,
    },
    {
      label:
        "Environmental damage can be defined as a process of deterioration or decline in environmental quality which is also characterized by the loss of soil, water, and air resources, the extinction of soil, water, and air resources, the extinction of wild flora and fauna, and ecosystem damage.",
      value: false,
    },
    {
      label:
        "Environmental damage can be defined as a process of deterioration or decline in environmental quality because it is characterized by the loss of soil, water, and air resources, the extinction of wild flora and fauna, and ecosystem damage.",
      value: false,
    },
    {
      label:
        "Environmental damage can be defined as a process of deterioration or decline in environmental quality, but is also characterized by the loss of soil, water, and air resources, the extinction of wild flora and fauna, and ecosystem damage.",
      value: false,
    },
  ],
};

export default choices;
