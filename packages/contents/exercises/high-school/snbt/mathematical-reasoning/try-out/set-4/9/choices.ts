import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$5\\text{ Meter dan }5\\text{ Meter}$$", value: true },
    { label: "$$5\\text{ Meter dan }6\\text{ Meter}$$", value: false },
    { label: "$$4\\text{ Meter dan }6\\text{ Meter}$$", value: false },
    { label: "$$6\\text{ Meter dan }4\\text{ Meter}$$", value: false },
    { label: "$$8\\text{ Meter dan }2\\text{ Meter}$$", value: false },
  ],
  en: [
    { label: "$$5\\text{ Meters and }5\\text{ Meters}$$", value: true },
    { label: "$$5\\text{ Meters and }6\\text{ Meters}$$", value: false },
    { label: "$$4\\text{ Meters and }6\\text{ Meters}$$", value: false },
    { label: "$$6\\text{ Meters and }4\\text{ Meters}$$", value: false },
    { label: "$$8\\text{ Meters and }2\\text{ Meters}$$", value: false },
  ],
};

export default choices;
