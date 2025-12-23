import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$C + \\text{Rp}4.000,00$$", value: false },
    { label: "$$2C + \\text{Rp}4.000,00$$", value: false },
    { label: "$$\\frac{4}{3}C + \\text{Rp}4.000,00$$", value: true },
    { label: "$$\\frac{3}{2}C + \\text{Rp}1.000,00$$", value: false },
    { label: "$$2C + \\text{Rp}2.000,00$$", value: false },
  ],
  en: [
    { label: "$$C + \\text{Rp}4,000.00$$", value: false },
    { label: "$$2C + \\text{Rp}4,000.00$$", value: false },
    { label: "$$\\frac{4}{3}C + \\text{Rp}4,000.00$$", value: true },
    { label: "$$\\frac{3}{2}C + \\text{Rp}1,000.00$$", value: false },
    { label: "$$2C + \\text{Rp}2,000.00$$", value: false },
  ],
};

export default choices;
