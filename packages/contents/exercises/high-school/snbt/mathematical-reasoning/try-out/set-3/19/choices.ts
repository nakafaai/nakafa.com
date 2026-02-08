import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$3,2\\text{ km}$$", value: false },
    { label: "$$6,4\\text{ km}$$", value: false },
    { label: "$$7,0\\text{ km}$$", value: false },
    { label: "$$7,6\\text{ km}$$", value: true },
    { label: "$$8,4\\text{ km}$$", value: false },
  ],
  en: [
    { label: "$$3.2\\text{ km}$$", value: false },
    { label: "$$6.4\\text{ km}$$", value: false },
    { label: "$$7.0\\text{ km}$$", value: false },
    { label: "$$7.6\\text{ km}$$", value: true },
    { label: "$$8.4\\text{ km}$$", value: false },
  ],
};

export default choices;
