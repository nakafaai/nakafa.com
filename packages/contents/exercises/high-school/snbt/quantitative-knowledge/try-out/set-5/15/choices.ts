import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$4 \\text{ atau } -2$$", value: true },
    { label: "$$-4 \\text{ atau } 2$$", value: false },
    { label: "$$-2 \\text{ atau } 3$$", value: false },
    { label: "$$2 \\text{ atau } -3$$", value: false },
    { label: "$$3 \\text{ atau } 8$$", value: false },
  ],
  en: [
    { label: "$$4 \\text{ or } -2$$", value: true },
    { label: "$$-4 \\text{ or } 2$$", value: false },
    { label: "$$-2 \\text{ or } 3$$", value: false },
    { label: "$$2 \\text{ or } -3$$", value: false },
    { label: "$$3 \\text{ or } 8$$", value: false },
  ],
};

export default choices;
