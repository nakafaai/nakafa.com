import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$60 \\text{ tahun}$$", value: false },
    { label: "$$57 \\text{ tahun}$$", value: true },
    { label: "$$56 \\text{ tahun}$$", value: false },
    { label: "$$54 \\text{ tahun}$$", value: false },
    { label: "$$52 \\text{ tahun}$$", value: false },
  ],
  en: [
    { label: "$$60 \\text{ years}$$", value: false },
    { label: "$$57 \\text{ years}$$", value: true },
    { label: "$$56 \\text{ years}$$", value: false },
    { label: "$$54 \\text{ years}$$", value: false },
    { label: "$$52 \\text{ years}$$", value: false },
  ],
};

export default choices;
