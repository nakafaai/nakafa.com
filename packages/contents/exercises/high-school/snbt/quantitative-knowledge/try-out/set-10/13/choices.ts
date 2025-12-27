import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "$$1\\frac{1}{8}; 0,875; \\frac{3}{4}; \\frac{1}{\\sqrt{2}}; 12,5\\%$$",
      value: true,
    },
    {
      label:
        "$$1\\frac{1}{8}; \\frac{3}{4}; \\frac{1}{\\sqrt{2}}; 12,5\\%; 0,875$$",
      value: false,
    },
    {
      label:
        "$$1\\frac{1}{8}; 0,875; 12,5\\%; \\frac{3}{4}; \\frac{1}{\\sqrt{2}}$$",
      value: false,
    },
    {
      label:
        "$$0,875; 1\\frac{1}{8}; \\frac{3}{4}; \\frac{1}{\\sqrt{2}}; 12,5\\%$$",
      value: false,
    },
    {
      label:
        "$$\\frac{1}{\\sqrt{2}}; 1\\frac{1}{8}; 0,875; \\frac{3}{4}; 12,5\\%$$",
      value: false,
    },
  ],
  en: [
    {
      label:
        "$$1\\frac{1}{8}; 0.875; \\frac{3}{4}; \\frac{1}{\\sqrt{2}}; 12.5\\%$$",
      value: true,
    },
    {
      label:
        "$$1\\frac{1}{8}; \\frac{3}{4}; \\frac{1}{\\sqrt{2}}; 12.5\\%; 0.875$$",
      value: false,
    },
    {
      label:
        "$$1\\frac{1}{8}; 0.875; 12.5\\%; \\frac{3}{4}; \\frac{1}{\\sqrt{2}}$$",
      value: false,
    },
    {
      label:
        "$$0.875; 1\\frac{1}{8}; \\frac{3}{4}; \\frac{1}{\\sqrt{2}}; 12.5\\%$$",
      value: false,
    },
    {
      label:
        "$$\\frac{1}{\\sqrt{2}}; 1\\frac{1}{8}; 0.875; \\frac{3}{4}; 12.5\\%$$",
      value: false,
    },
  ],
};

export default choices;
