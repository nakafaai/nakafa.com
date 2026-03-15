import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$2\\frac{1}{2} \\text{ Meter}$$", value: true },
    { label: "$$3\\frac{1}{2} \\text{ Meter}$$", value: false },
    { label: "$$4\\frac{1}{2} \\text{ Meter}$$", value: false },
    { label: "$$2\\frac{1}{3} \\text{ Meter}$$", value: false },
    { label: "$$3\\frac{1}{3} \\text{ Meter}$$", value: false },
  ],
  en: [
    { label: "$$2\\frac{1}{2} \\text{ Meters}$$", value: true },
    { label: "$$3\\frac{1}{2} \\text{ Meters}$$", value: false },
    { label: "$$4\\frac{1}{2} \\text{ Meters}$$", value: false },
    { label: "$$2\\frac{1}{3} \\text{ Meters}$$", value: false },
    { label: "$$3\\frac{1}{3} \\text{ Meters}$$", value: false },
  ],
};

export default choices;
