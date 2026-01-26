import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Konsumsi apel secara rutin dapat berpotensi menyebabkan seseorang obesitas.", value: false },
    { label: "Seseorang yang mengonsumsi makanan manis secara berlebihan dapat dikurangi dengan konsumsi apel.", value: false },
    { label: "Rasa manis pada apel memiliki kadar gula yang tinggi dan berpotensi membuat kenyang.", value: false },
    { label: "Sensasi kenyang lebih lama bisa didapatkan dari konsumsi apel karena kandungan serat dan air di dalamnya.", value: true },
    { label: "Apel adalah buah yang memiliki kandungan vitamin dan mineral yang paling tinggi dari buah lainnya.", value: false },
  ],
  en: [
    { label: "Regular apple consumption can potentially cause someone to become obese.", value: false },
    { label: "Someone who consumes sweet foods excessively can be reduced by apple consumption.", value: false },
    { label: "The sweet taste in apples has a high sugar level and potentially makes one full.", value: false },
    { label: "A longer sensation of fullness can be obtained from apple consumption due to the fiber and water content in it.", value: true },
    { label: "Apples are the fruit that has the highest vitamin and mineral content compared to other fruits.", value: false },
  ],
};

export default choices;
