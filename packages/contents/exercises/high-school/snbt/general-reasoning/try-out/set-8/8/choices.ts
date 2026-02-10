import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Buah nanas baik untuk dikonsumsi karena dapat mencegah infeksi penyakit",
      value: false,
    },
    {
      label:
        "Kandungan vitamin C pada nanas dapat memicu penyakit maag seperti perut mual dan kembung",
      value: true,
    },
    {
      label:
        "Kandungan enzim bromelain pada nanas tidak baik bagi seseorang yang menderita maag",
      value: false,
    },
    {
      label:
        "Vitamin C pada nanas dapat mencegah seseorang tertular penyakit musiman seperti flu",
      value: false,
    },
    {
      label:
        "Walaupun dapat memicu gejala maag, mengonsumsi nanas tidak mengganggu pencernaan",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Pineapples are good to consume because they can prevent infectious diseases",
      value: false,
    },
    {
      label:
        "The Vitamin C content in pineapples can trigger ulcer symptoms like nausea and bloating",
      value: true,
    },
    {
      label:
        "The bromelain enzyme content in pineapples is not good for someone suffering from ulcers",
      value: false,
    },
    {
      label:
        "Vitamin C in pineapples can prevent someone from catching seasonal diseases like the flu",
      value: false,
    },
    {
      label:
        "Although it can trigger ulcer symptoms, consuming pineapples does not disturb digestion",
      value: false,
    },
  ],
};

export default choices;
