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
      {
        title: "Logarithm Definition",
        href: `${BASE_PATH}/exponential-logarithm/logarithm-definition`,
      },
      {
        title: "Logarithm Properties",
        href: `${BASE_PATH}/exponential-logarithm/logarithm-properties`,
      },
    ],
  },
  {
    title: "Sequences and Series",
    description:
      "Amazing patterns connecting numbers in fascinating sequences.",
    href: `${BASE_PATH}/sequence-series`,
    items: [
      {
        title: "Sequence Concepts",
        href: `${BASE_PATH}/sequence-series/sequence-concept`,
      },
      {
        title: "Arithmetic Sequences",
        href: `${BASE_PATH}/sequence-series/arithmetic-sequence`,
      },
      {
        title: "Arithmetic Sequence Analogies",
        href: `${BASE_PATH}/sequence-series/analogies-arithmetic-sequence`,
      },
      {
        title: "Geometric Sequences",
        href: `${BASE_PATH}/sequence-series/geometric-sequence`,
      },
      {
        title: "Geometric Sequence Analogies",
        href: `${BASE_PATH}/sequence-series/analogies-geometric-sequence`,
      },
      {
        title: "Differences Between Arithmetic and Geometric Sequences",
        href: `${BASE_PATH}/sequence-series/difference-arithmetic-geometric-sequence`,
      },
      {
        title: "Series Concepts",
        href: `${BASE_PATH}/sequence-series/series-concept`,
      },
      {
        title: "Arithmetic Series",
        href: `${BASE_PATH}/sequence-series/arithmetic-series`,
      },
      {
        title: "Geometric Series",
        href: `${BASE_PATH}/sequence-series/geometric-series`,
      },
      {
        title: "Infinite Geometric Series",
        href: `${BASE_PATH}/sequence-series/infinite-geometric-series`,
      },
      {
        title: "Convergence and Divergence",
        href: `${BASE_PATH}/sequence-series/convergence-divergence`,
      },
      {
        title: "Differences Between Arithmetic and Geometric Series",
        href: `${BASE_PATH}/sequence-series/difference-arithmetic-geometric-series`,
      },
      {
        title: "Differences Between Sequences and Series",
        href: `${BASE_PATH}/sequence-series/difference-sequence-series`,
      },
    ],
  },
  {
    title: "Vectors and Operations",
    description:
      "Core concepts of 3D games, physics, and satellite navigation.",
    href: `${BASE_PATH}/vector-operations`,
    items: [
      {
        title: "Vector Concept",
        href: `${BASE_PATH}/vector-operations/vector-concept`,
      },
      {
        title: "Vector Types",
        href: `${BASE_PATH}/vector-operations/vector-types`,
      },
      {
        title: "Vectors and Coordinate System",
        href: `${BASE_PATH}/vector-operations/vector-coordinate-system`,
      },
      {
        title: "Two-Dimensional Vector",
        href: `${BASE_PATH}/vector-operations/two-dimensional-vector`,
      },
      {
        title: "Vector Components",
        href: `${BASE_PATH}/vector-operations/vector-components`,
      },
      {
        title: "Three-Dimensional Vector",
        href: `${BASE_PATH}/vector-operations/three-dimensional-vector`,
      },
      {
        title: "Column and Row Vectors",
        href: `${BASE_PATH}/vector-operations/column-row-vector`,
      },
      {
        title: "Types of Vectors",
        href: `${BASE_PATH}/vector-operations/types-of-vector`,
      },
      {
        title: "Vector Addition",
        href: `${BASE_PATH}/vector-operations/vector-addition`,
      },
      {
        title: "Vector Subtraction",
        href: `${BASE_PATH}/vector-operations/vector-subtraction`,
      },
      {
        title: "Vector Operation Properties",
        href: `${BASE_PATH}/vector-operations/vector-properties`,
      },
      {
        title: "Zero Vector",
        href: `${BASE_PATH}/vector-operations/zero-vector`,
      },
      {
        title: "Scalar Vector Multiplication",
        href: `${BASE_PATH}/vector-operations/scalar-multiplication`,
      },
    ],
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
