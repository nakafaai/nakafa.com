import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$x = 30^\\circ + k \\cdot 180^\\circ$$, $$k$$ bilangan bulat",
      value: false,
    },
    {
      label: "$$x = 60^\\circ + k \\cdot 180^\\circ$$, $$k$$ bilangan bulat",
      value: false,
    },
    {
      label: "$$x = 90^\\circ + k \\cdot 180^\\circ$$, $$k$$ bilangan bulat",
      value: false,
    },
    {
      label: "$$x = 120^\\circ + k \\cdot 180^\\circ$$, $$k$$ bilangan bulat",
      value: true,
    },
    {
      label: "$$x = 150^\\circ + k \\cdot 180^\\circ$$, $$k$$ bilangan bulat",
      value: false,
    },
  ],
  en: [
    {
      label: "$$x = 30^\\circ + k \\cdot 180^\\circ$$, $$k$$ is an integer",
      value: false,
    },
    {
      label: "$$x = 60^\\circ + k \\cdot 180^\\circ$$, $$k$$ is an integer",
      value: false,
    },
    {
      label: "$$x = 90^\\circ + k \\cdot 180^\\circ$$, $$k$$ is an integer",
      value: false,
    },
    {
      label: "$$x = 120^\\circ + k \\cdot 180^\\circ$$, $$k$$ is an integer",
      value: true,
    },
    {
      label: "$$x = 150^\\circ + k \\cdot 180^\\circ$$, $$k$$ is an integer",
      value: false,
    },
  ],
};

export default choices;
