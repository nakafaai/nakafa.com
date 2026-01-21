import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$41\\text{ jam }15\\text{ menit}$$", value: true },
    { label: "$$41\\text{ jam }25\\text{ menit}$$", value: false },
    { label: "$$42\\text{ jam }15\\text{ menit}$$", value: false },
    { label: "$$42\\text{ jam }25\\text{ menit}$$", value: false },
    { label: "$$42\\text{ jam }45\\text{ menit}$$", value: false },
  ],
  en: [
    { label: "$$41\\text{ hours }15\\text{ minutes}$$", value: true },
    { label: "$$41\\text{ hours }25\\text{ minutes}$$", value: false },
    { label: "$$42\\text{ hours }15\\text{ minutes}$$", value: false },
    { label: "$$42\\text{ hours }25\\text{ minutes}$$", value: false },
    { label: "$$42\\text{ hours }45\\text{ minutes}$$", value: false },
  ],
};

export default choices;
