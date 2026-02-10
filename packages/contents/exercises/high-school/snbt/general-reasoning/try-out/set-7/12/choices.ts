import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$1,75\\text{ meter}$$", value: false },
    { label: "$$1,85\\text{ meter}$$", value: false },
    { label: "$$1,90\\text{ meter}$$", value: false },
    { label: "$$2,00\\text{ meter}$$", value: true },
    { label: "$$2,10\\text{ meter}$$", value: false },
  ],
  en: [
    { label: "$$1.75\\text{ meters}$$", value: false },
    { label: "$$1.85\\text{ meters}$$", value: false },
    { label: "$$1.90\\text{ meters}$$", value: false },
    { label: "$$2.00\\text{ meters}$$", value: true },
    { label: "$$2.10\\text{ meters}$$", value: false },
  ],
};

export default choices;
