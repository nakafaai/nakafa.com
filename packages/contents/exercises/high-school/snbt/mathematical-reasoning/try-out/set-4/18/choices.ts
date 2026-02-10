import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$10\\frac{2}{15}\\text{ km}$$", value: true },
    { label: "$$10\\frac{1}{15}\\text{ km}$$", value: false },
    { label: "$$5\\frac{2}{15}\\text{ km}$$", value: false },
    { label: "$$5\\frac{1}{15}\\text{ km}$$", value: false },
    { label: "$$5\\frac{3}{5}\\text{ km}$$", value: false },
  ],
  en: [
    { label: "$$10\\frac{2}{15}\\text{ km}$$", value: true },
    { label: "$$10\\frac{1}{15}\\text{ km}$$", value: false },
    { label: "$$5\\frac{2}{15}\\text{ km}$$", value: false },
    { label: "$$5\\frac{1}{15}\\text{ km}$$", value: false },
    { label: "$$5\\frac{3}{5}\\text{ km}$$", value: false },
  ],
};

export default choices;
