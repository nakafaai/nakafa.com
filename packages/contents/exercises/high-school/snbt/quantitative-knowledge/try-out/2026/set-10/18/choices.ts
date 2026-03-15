import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$\\{x | -3 \\leq x, x \\in \\text{bilangan bulat}\\}$$",
      value: false,
    },
    {
      label: "$$\\{x | -3 < x, x \\in \\text{bilangan bulat}\\}$$",
      value: false,
    },
    {
      label: "$$\\{x | x \\leq 7, x \\in \\text{bilangan bulat}\\}$$",
      value: false,
    },
    {
      label: "$$\\{x | -3 < x \\leq 7, x \\in \\text{bilangan bulat}\\}$$",
      value: true,
    },
    {
      label: "$$\\{x | -3 < x < 7, x \\in \\text{bilangan bulat}\\}$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\{x | -3 \\leq x, x \\in \\text{integers}\\}$$",
      value: false,
    },
    { label: "$$\\{x | -3 < x, x \\in \\text{integers}\\}$$", value: false },
    { label: "$$\\{x | x \\leq 7, x \\in \\text{integers}\\}$$", value: false },
    {
      label: "$$\\{x | -3 < x \\leq 7, x \\in \\text{integers}\\}$$",
      value: true,
    },
    {
      label: "$$\\{x | -3 < x < 7, x \\in \\text{integers}\\}$$",
      value: false,
    },
  ],
};

export default choices;
