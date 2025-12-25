import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$(1), (2), \\text{ dan } (3) \\text{ benar}.$$", value: false },
    { label: "$$(1) \\text{ dan } (3) \\text{ benar}.$$", value: false },
    { label: "$$(2) \\text{ dan } (4) \\text{ benar}.$$", value: true },
    { label: "$$(4) \\text{ saja benar}.$$", value: false },
    { label: "$$\\text{Semua benar}.$$", value: false },
  ],
  en: [
    {
      label: "$$(1), (2), \\text{ and } (3) \\text{ are correct}.$$",
      value: false,
    },
    { label: "$$(1) \\text{ and } (3) \\text{ are correct}.$$", value: false },
    { label: "$$(2) \\text{ and } (4) \\text{ are correct}.$$", value: true },
    { label: "$$\\text{Only } (4) \\text{ is correct}.$$", value: false },
    { label: "$$\\text{All are correct}.$$", value: false },
  ],
};

export default choices;
