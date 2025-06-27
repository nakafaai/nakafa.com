import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Vectors",
    description:
      "Mathematical language to describe direction and magnitude in 3D world, from GPS to gaming.",
    href: `${BASE_PATH}/vector`,
    items: [],
  },
  {
    title: "Kinematics",
    description:
      "The art of predicting motion from bullets to satellites without caring about the cause.",
    href: `${BASE_PATH}/kinematics`,
    items: [],
  },
  {
    title: "Particle Dynamics",
    description:
      "The secret behind every movement, from rockets launching to cars turning safely.",
    href: `${BASE_PATH}/particle-dynamics`,
    items: [],
  },
  {
    title: "Fluids",
    description:
      "Science that reveals the mystery of flowing liquids and moving gases in daily life.",
    href: `${BASE_PATH}/fluid`,
    items: [],
  },
  {
    title: "Waves, Sound, and Light",
    description:
      "Amazing phenomena that allow us to hear music and see the world around us.",
    href: `${BASE_PATH}/wave-sound-light`,
    items: [],
  },
  {
    title: "Heat",
    description:
      "Hidden energy that powers engines and warms our homes every day.",
    href: `${BASE_PATH}/heat`,
    items: [],
  },
  {
    title: "Thermodynamics",
    description:
      "Fundamental laws of the universe that govern engine efficiency and life itself.",
    href: `${BASE_PATH}/thermodynamics`,
    items: [],
  },
] as const;

export default enMaterials;
