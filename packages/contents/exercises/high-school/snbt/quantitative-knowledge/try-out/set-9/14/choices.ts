import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$\\frac{17}{14}; 123\\%; 1,45; \\frac{5}{3}; \\sqrt{12}$$",
      value: true,
    },
    {
      label: "$$\\frac{17}{14}; 123\\%; 1,45; \\sqrt{12}; \\frac{5}{3}$$",
      value: false,
    },
    {
      label: "$$\\frac{5}{3}; \\frac{17}{14}; 123\\%; 1,45; \\sqrt{12}$$",
      value: false,
    },
    {
      label: "$$\\frac{5}{3}; 123\\%; 1,45; \\sqrt{12}; \\frac{17}{14}$$",
      value: false,
    },
    {
      label: "$$123\\%; \\frac{5}{3}; 1,45; \\sqrt{12}; \\frac{17}{14}$$",
      value: false,
    },
  ],
  en: [
    {
      label: "$$\\frac{17}{14}; 123\\%; 1.45; \\frac{5}{3}; \\sqrt{12}$$",
      value: true,
    },
    {
      label: "$$\\frac{17}{14}; 123\\%; 1.45; \\sqrt{12}; \\frac{5}{3}$$",
      value: false,
    },
    {
      label: "$$\\frac{5}{3}; \\frac{17}{14}; 123\\%; 1.45; \\sqrt{12}$$",
      value: false,
    },
    {
      label: "$$\\frac{5}{3}; 123\\%; 1.45; \\sqrt{12}; \\frac{17}{14}$$",
      value: false,
    },
    {
      label: "$$123\\%; \\frac{5}{3}; 1.45; \\sqrt{12}; \\frac{17}{14}$$",
      value: false,
    },
  ],
};

export default choices;
