import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$81 \\text{ dan } 10$$", value: false },
    { label: "$$65 \\text{ dan } 9$$", value: true },
    { label: "$$66 \\text{ dan } 11$$", value: false },
    { label: "$$68 \\text{ dan } 12$$", value: false },
    { label: "$$68 \\text{ dan } 8$$", value: false },
  ],
  en: [
    { label: "$$81 \\text{ and } 10$$", value: false },
    { label: "$$65 \\text{ and } 9$$", value: true },
    { label: "$$66 \\text{ and } 11$$", value: false },
    { label: "$$68 \\text{ and } 12$$", value: false },
    { label: "$$68 \\text{ and } 8$$", value: false },
  ],
};

export default choices;
