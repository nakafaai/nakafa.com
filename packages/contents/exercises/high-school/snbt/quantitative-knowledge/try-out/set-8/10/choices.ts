import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$m < 0 \\lor m > \\frac{1}{2}$$", value: false },
    { label: "$$-\\frac{1}{2} < m < \\frac{1}{2}$$", value: false },
    { label: "$$0 < m < \\frac{1}{2}$$", value: true },
    { label: "$$0 \\leq m < \\frac{1}{2}$$", value: false },
    { label: "$$m < -\\frac{1}{2} \\lor m > 0$$", value: false },
  ],
  en: [
    { label: "$$m < 0 \\lor m > \\frac{1}{2}$$", value: false },
    { label: "$$-\\frac{1}{2} < m < \\frac{1}{2}$$", value: false },
    { label: "$$0 < m < \\frac{1}{2}$$", value: true },
    { label: "$$0 \\leq m < \\frac{1}{2}$$", value: false },
    { label: "$$m < -\\frac{1}{2} \\lor m > 0$$", value: false },
  ],
};

export default choices;
