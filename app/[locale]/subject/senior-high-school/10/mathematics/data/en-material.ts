import type { MaterialList } from "@/types/subjects";
import { BASE_PATH } from ".";

const enMaterials: MaterialList[] = [
  {
    title: "Exponents and Logarithms",
    description:
      "The mathematical power behind modern technology and exponential growth.",
    href: `${BASE_PATH}/exponential-logarithm`,
    items: [
      {
        title: "Exponent Concepts",
        href: `${BASE_PATH}/exponential-logarithm/basic-concept`,
      },
      {
        title: "Exponent Properties",
        href: `${BASE_PATH}/exponential-logarithm/properties`,
      },
      {
        title: "Property Proofs",
        href: `${BASE_PATH}/exponential-logarithm/proof-properties`,
      },
      {
        title: "Function Exploration",
        href: `${BASE_PATH}/exponential-logarithm/function-exploration`,
      },
      {
        title: "Function Definition",
        href: `${BASE_PATH}/exponential-logarithm/function-definition`,
      },
      {
        title: "Function Comparison",
        href: `${BASE_PATH}/exponential-logarithm/function-comparison`,
      },
      {
        title: "Function Modeling",
        href: `${BASE_PATH}/exponential-logarithm/function-modeling`,
      },
      {
        title: "Exponential Decay",
        href: `${BASE_PATH}/exponential-logarithm/exponential-decay`,
      },
      {
        title: "Radical Forms",
        href: `${BASE_PATH}/exponential-logarithm/radical-form`,
      },
      {
        title: "Rationalizing Radicals",
        href: `${BASE_PATH}/exponential-logarithm/rationalizing-radicals`,
      },
    ],
  },
  {
    title: "Sequences and Series",
    description:
      "Amazing patterns connecting numbers in fascinating sequences.",
    href: `${BASE_PATH}/sequence-series`,
    items: [],
  },
  {
    title: "Vectors and Operations",
    description:
      "Core concepts of 3D games, physics, and satellite navigation.",
    href: `${BASE_PATH}/vector-operations`,
    items: [],
  },
  {
    title: "Trigonometry",
    description:
      "The language of triangles for building structures and exploring space.",
    href: `${BASE_PATH}/trigonometry`,
    items: [],
  },
  {
    title: "Systems of Linear Equations and Inequalities",
    description:
      "The key to optimizing business and solving real-world problems.",
    href: `${BASE_PATH}/linear-equation-inequality`,
    items: [],
  },
  {
    title: "Quadratic Functions",
    description:
      "Parabolic curves explaining projectile motion and bridge design.",
    href: `${BASE_PATH}/quadratic-function`,
    items: [],
  },
  {
    title: "Statistics",
    description: "The art of data analysis for real-world decision making.",
    href: `${BASE_PATH}/statistics`,
    items: [],
  },
  {
    title: "Probability",
    description:
      "Mathematics of uncertainty behind AI, weather forecasting, and game strategy.",
    href: `${BASE_PATH}/probability`,
    items: [],
  },
] as const;

export default enMaterials;
