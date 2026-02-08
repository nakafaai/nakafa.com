import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$\\frac{27\\sqrt{5}}{2}\\text{ cm}^2$$", value: true },
    { label: "$$\\frac{27\\sqrt{6}}{2}\\text{ cm}^2$$", value: false },
    { label: "$$\\frac{27\\sqrt{3}}{2}\\text{ cm}^2$$", value: false },
    { label: "$$\\frac{27\\sqrt{2}}{2}\\text{ cm}^2$$", value: false },
    { label: "$$27\\text{ cm}^2$$", value: false },
  ],
  en: [
    { label: "$$\\frac{27\\sqrt{5}}{2}\\text{ cm}^2$$", value: true },
    { label: "$$\\frac{27\\sqrt{6}}{2}\\text{ cm}^2$$", value: false },
    { label: "$$\\frac{27\\sqrt{3}}{2}\\text{ cm}^2$$", value: false },
    { label: "$$\\frac{27\\sqrt{2}}{2}\\text{ cm}^2$$", value: false },
    { label: "$$27\\text{ cm}^2$$", value: false },
  ],
};

export default choices;
