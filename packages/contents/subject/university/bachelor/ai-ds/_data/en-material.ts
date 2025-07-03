import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Linear Methods of AI",
    description:
      "Mathematical backbone transforming data patterns into intelligent predictions.",
    href: `${BASE_PATH}/linear-methods`,
    items: [],
  },
  {
    title: "AI Programming",
    description:
      "Coding intelligence that teaches machines to think and solve complex problems.",
    href: `${BASE_PATH}/ai-programming`,
    items: [],
  },
  {
    title: "Neural Networks",
    description:
      "Digital brains mimicking human neurons to recognize patterns and make decisions.",
    href: `${BASE_PATH}/neural-networks`,
    items: [],
  },
  {
    title: "Machine Learning",
    description:
      "Algorithms that learn from experience to predict future outcomes automatically.",
    href: `${BASE_PATH}/machine-learning`,
    items: [],
  },
  {
    title: "Nonlinear Optimization for AI",
    description:
      "Advanced mathematics finding optimal solutions in complex AI problem spaces.",
    href: `${BASE_PATH}/nonlinear-optimization`,
    items: [],
  },
  {
    title: "Advanced Machine Learning",
    description:
      "Cutting-edge techniques pushing the boundaries of artificial intelligence capabilities.",
    href: `${BASE_PATH}/advanced-machine-learning`,
    items: [],
  },
  {
    title: "Computer Vision",
    description:
      "Teaching machines to see and understand the visual world like humans.",
    href: `${BASE_PATH}/computer-vision`,
    items: [],
  },
  {
    title: "Natural Language Processing",
    description:
      "Bridging human language and machine understanding for seamless communication.",
    href: `${BASE_PATH}/nlp`,
    items: [],
  },
] as const;

export default enMaterials;
