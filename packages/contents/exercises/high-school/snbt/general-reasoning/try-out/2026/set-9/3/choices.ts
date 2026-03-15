import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Jika hama tanaman tidak meningkat maka kenaikan suhu karena perubahan iklim telah terjadi",
      value: false,
    },
    {
      label:
        "Jika hama tanaman tidak meningkat maka kenaikan suhu karena perubahan iklim tidak terjadi",
      value: true,
    },
    {
      label:
        "Jika tidak terjadi perubahan iklim maka hama-hama tidak akan memperluas jangkauan mereka",
      value: false,
    },
    {
      label:
        "Jika hama-hama memperluas jangkauan mereka maka akan terjadi perubahan iklim",
      value: false,
    },
    {
      label:
        "Populasi hama akan meningkat jika pemangsa hama seperti burung mengubah waktu migrasi",
      value: false,
    },
  ],
  en: [
    {
      label:
        "If plant pests do not increase then the temperature rise due to climate change has occurred",
      value: false,
    },
    {
      label:
        "If plant pests do not increase then the temperature rise due to climate change did not occur",
      value: true,
    },
    {
      label:
        "If climate change does not occur then pests will not expand their range",
      value: false,
    },
    {
      label: "If pests expand their range then climate change will occur",
      value: false,
    },
    {
      label:
        "Pest populations will increase if pest predators such as birds change migration times",
      value: false,
    },
  ],
};

export default choices;
