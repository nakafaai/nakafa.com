import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "Rp$$2.500,00$$", value: false },
    { label: "Rp$$3.000,00$$", value: false },
    { label: "Rp$$4.000,00$$", value: true },
    { label: "Rp$$5.000,00$$", value: false },
    { label: "Rp$$5.500,00$$", value: false },
  ],
  en: [
    { label: "Rp$$2.500,00$$", value: false },
    { label: "Rp$$3.000,00$$", value: false },
    { label: "Rp$$4.000,00$$", value: true },
    { label: "Rp$$5.000,00$$", value: false },
    { label: "Rp$$5.500,00$$", value: false },
  ],
};

export default choices;
