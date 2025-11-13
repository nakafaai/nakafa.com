import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "$$r = \\sqrt{8}$$, sudut $$\\alpha$$ ada di kuadran $$\\text{II}$$ atau $$\\text{IV}$$",
      value: false,
    },
    {
      label:
        "$$r = \\sqrt{8}$$, sudut $$\\alpha$$ ada di kuadran $$\\text{II}$$",
      value: false,
    },
    {
      label:
        "$$r = \\sqrt{10}$$, sudut $$\\alpha$$ ada di kuadran $$\\text{II}$$ atau $$\\text{IV}$$",
      value: false,
    },
    {
      label:
        "$$r = \\sqrt{10}$$, sudut $$\\alpha$$ ada di kuadran $$\\text{II}$$",
      value: true,
    },
    {
      label: "$$r = 3$$, sudut $$\\alpha$$ ada di kuadran $$\\text{IV}$$",
      value: false,
    },
  ],
  en: [
    {
      label:
        "$$r = \\sqrt{8}$$, angle $$\\alpha$$ is in quadrant $$\\text{II}$$ or $$\\text{IV}$$",
      value: false,
    },
    {
      label:
        "$$r = \\sqrt{8}$$, angle $$\\alpha$$ is in quadrant $$\\text{II}$$",
      value: false,
    },
    {
      label:
        "$$r = \\sqrt{10}$$, angle $$\\alpha$$ is in quadrant $$\\text{II}$$ or $$\\text{IV}$$",
      value: false,
    },
    {
      label:
        "$$r = \\sqrt{10}$$, angle $$\\alpha$$ is in quadrant $$\\text{II}$$",
      value: true,
    },
    {
      label: "$$r = 3$$, angle $$\\alpha$$ is in quadrant $$\\text{IV}$$",
      value: false,
    },
  ],
};

export default choices;
