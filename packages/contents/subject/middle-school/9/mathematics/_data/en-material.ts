import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "System of Linear Equations in Two Variables",
    description: "Solving problems with two related variables.",
    href: `${BASE_PATH}/linear-equations-two-variables`,
    items: [
      {
        title: "",
        href: `${BASE_PATH}/`,
      },
    ],
  },
  {
    title: "Solid Geometry",
    description: "Exploring volume and surface area of 3D objects.",
    href: `${BASE_PATH}/solid-geometry`,
    items: [
      {
        title: "",
        href: `${BASE_PATH}/`,
      },
    ],
  },
  {
    title: "Geometric Transformation",
    description: "Moving and changing geometric shapes.",
    href: `${BASE_PATH}/geometric-transformation`,
    items: [
      {
        title: "",
        href: `${BASE_PATH}/`,
      },
    ],
  },
  {
    title: "Probability and Sampling",
    description: "Predicting likelihood and understanding sampling.",
    href: `${BASE_PATH}/probability-sampling`,
    items: [
      {
        title: "",
        href: `${BASE_PATH}/`,
      },
    ],
  },
] as const;

export default enMaterials;
