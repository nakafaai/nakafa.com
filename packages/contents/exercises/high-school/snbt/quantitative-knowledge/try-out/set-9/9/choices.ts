import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$Df = \\{x | x \\leq 5\\}$$", value: false },
    { label: "$$Df = \\{x | 2 < x \\leq 5\\}$$", value: false },
    {
      label: "$$Df = \\{x | x < -3 \\text{ atau } 2 < x < 5\\}$$",
      value: false,
    },
    {
      label: "$$Df = \\{x | x < -3 \\text{ atau } 2 < x \\leq 5\\}$$",
      value: true,
    },
    {
      label: "$$Df = \\{x | x < -3 \\text{ atau } 2 \\leq x \\leq 5\\}$$",
      value: false,
    },
  ],
  en: [
    { label: "$$Df = \\{x | x \\leq 5\\}$$", value: false },
    { label: "$$Df = \\{x | 2 < x \\leq 5\\}$$", value: false },
    { label: "$$Df = \\{x | x < -3 \\text{ or } 2 < x < 5\\}$$", value: false },
    {
      label: "$$Df = \\{x | x < -3 \\text{ or } 2 < x \\leq 5\\}$$",
      value: true,
    },
    {
      label: "$$Df = \\{x | x < -3 \\text{ or } 2 \\leq x \\leq 5\\}$$",
      value: false,
    },
  ],
};

export default choices;
