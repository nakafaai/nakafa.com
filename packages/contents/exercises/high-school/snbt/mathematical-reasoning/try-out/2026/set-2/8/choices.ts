import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Bulan ke-$$37$$", value: false },
    { label: "Bulan ke-$$38$$", value: true },
    { label: "Bulan ke-$$39$$", value: false },
    { label: "Bulan ke-$$40$$", value: false },
    { label: "Bulan ke-$$41$$", value: false },
  ],
  en: [
    { label: "$$37^{\\text{th}}$$ Month", value: false },
    { label: "$$38^{\\text{th}}$$ Month", value: true },
    { label: "$$39^{\\text{th}}$$ Month", value: false },
    { label: "$$40^{\\text{th}}$$ Month", value: false },
    { label: "$$41^{\\text{st}}$$ Month", value: false },
  ],
};

export default choices;
