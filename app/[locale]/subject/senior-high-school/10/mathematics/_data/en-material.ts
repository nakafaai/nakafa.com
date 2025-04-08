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
        title: "Exponential Growth",
        href: `${BASE_PATH}/exponential-logarithm/exponential-growth`,
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
        title: "Geometric Sequences",
        href: `${BASE_PATH}/sequence-series/geometric-sequence`,
      },
      {
        title: "Differences Between Arithmetic and Geometric Sequences",
        href: `${BASE_PATH}/sequence-series/difference-arithmetic-geometric-sequence`,
      },
      {
        title: "Series Concept",
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
        title: "Difference between Convergence and Divergence",
        href: `${BASE_PATH}/sequence-series/convergence-divergence`,
      },
      {
        title: "Difference between Arithmetic and Geometric Series",
        href: `${BASE_PATH}/sequence-series/difference-arithmetic-geometric-series`,
      },
      {
        title: "Difference between Sequences and Series",
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
    items: [
      {
        title: "Trigonometry Concepts",
        href: `${BASE_PATH}/trigonometry/trigonometry-concept`,
      },
      {
        title: "Right Triangle Side Naming",
        href: `${BASE_PATH}/trigonometry/right-triangle-naming`,
      },
      {
        title: "Trigonometric Ratio: Tan θ",
        href: `${BASE_PATH}/trigonometry/trigonometric-comparison-tan`,
      },
      {
        title: "Applications of Tan θ Trigonometric Ratio",
        href: `${BASE_PATH}/trigonometry/trigonometric-comparison-tan-usage`,
      },
      {
        title: "Trigonometric Ratios: Sin θ and Cos θ",
        href: `${BASE_PATH}/trigonometry/trigonometric-comparison-sin-cos`,
      },
      {
        title: "The Three Primary Trigonometric Ratios",
        href: `${BASE_PATH}/trigonometry/trigonometric-comparison-three-primary`,
      },
      {
        title: "Special Angles in Trigonometric Ratios",
        href: `${BASE_PATH}/trigonometry/trigonometric-comparison-special-angle`,
      },
    ],
  },
  {
    title: "Systems of Linear Equations and Inequalities",
    description:
      "The key to optimizing business and solving real-world problems.",
    href: `${BASE_PATH}/linear-equation-inequality`,
    items: [
      {
        title: "Linear Equation Systems",
        href: `${BASE_PATH}/linear-equation-inequality/system-linear-equation`,
      },
      {
        title: "Linear Inequality Systems",
        href: `${BASE_PATH}/linear-equation-inequality/system-linear-inequality`,
      },
    ],
  },
  {
    title: "Quadratic Functions",
    description:
      "Parabolic curves explaining projectile motion and bridge design.",
    href: `${BASE_PATH}/quadratic-function`,
    items: [
      {
        title: "Quadratic Equations",
        href: `${BASE_PATH}/quadratic-function/quadratic-equation`,
      },
      {
        title: "Quadratic Equation Factorization",
        href: `${BASE_PATH}/quadratic-function/quadratic-equation-factorization`,
      },
      {
        title: "Completing the Square",
        href: `${BASE_PATH}/quadratic-function/quadratic-equation-perfect-square`,
      },
      {
        title: "Quadratic Formula",
        href: `${BASE_PATH}/quadratic-function/quadratic-equation-formula`,
      },
      {
        title: "Types of Quadratic Equation Roots",
        href: `${BASE_PATH}/quadratic-function/quadratic-equation-types-of-root`,
      },
      {
        title: "Imaginary or Non-Real Roots",
        href: `${BASE_PATH}/quadratic-function/quadratic-equation-imaginary-root`,
      },
      {
        title: "Characteristics of Quadratic Functions",
        href: `${BASE_PATH}/quadratic-function/quadratic-function-characteristics`,
      },
      {
        title: "Constructing Quadratic Functions",
        href: `${BASE_PATH}/quadratic-function/quadratic-function-construction`,
      },
      {
        title: "Determining Maximum Area",
        href: `${BASE_PATH}/quadratic-function/quadratic-function-maximum-area`,
      },
      {
        title: "Determining Minimum Area",
        href: `${BASE_PATH}/quadratic-function/quadratic-function-minimum-area`,
      },
    ],
  },
  {
    title: "Statistics",
    description: "The art of data analysis for real-world decision making.",
    href: `${BASE_PATH}/statistics`,
    items: [
      {
        title: "Histogram",
        href: `${BASE_PATH}/statistics/histogram`,
      },
      {
        title: "Relative Frequency",
        href: `${BASE_PATH}/statistics/relative-frequency`,
      },
      {
        title: "Mode and Median",
        href: `${BASE_PATH}/statistics/mode-median`,
      },
      {
        title: "Mean (Average)",
        href: `${BASE_PATH}/statistics/mean`,
      },
      {
        title: "Applications of Measures of Central Tendency",
        href: `${BASE_PATH}/statistics/central-tendency-usage`,
      },
      {
        title: "Mean for Grouped Data",
        href: `${BASE_PATH}/statistics/mean-group-data`,
      },
      {
        title: "Median and Modal Class for Grouped Data",
        href: `${BASE_PATH}/statistics/median-mode-group-data`,
      },
      {
        title: "Quartiles for Ungrouped Data",
        href: `${BASE_PATH}/statistics/quartile-data-single`,
      },
      {
        title: "Percentiles for Grouped Data",
        href: `${BASE_PATH}/statistics/percentile-data-group`,
      },
      {
        title: "Interquartile Range",
        href: `${BASE_PATH}/statistics/interquartile-range`,
      },
      {
        title: "Variance and Standard Deviation for Ungrouped Data",
        href: `${BASE_PATH}/statistics/variance-standard-deviation-data-single`,
      },
      {
        title: "Variance and Standard Deviation for Grouped Data",
        href: `${BASE_PATH}/statistics/variance-standard-deviation-data-group`,
      },
    ],
  },
  {
    title: "Probability",
    description:
      "Mathematics of uncertainty behind AI, weather forecasting, and game strategy.",
    href: `${BASE_PATH}/probability`,
    items: [
      {
        title: "Probability Distribution",
        href: `${BASE_PATH}/probability/probability-distribution`,
      },
      {
        title: "Addition Rule",
        href: `${BASE_PATH}/probability/addition-rule`,
      },
      {
        title: "Mutually Exclusive Events A and B",
        href: `${BASE_PATH}/probability/two-events-mutually-exclusive`,
      },
      {
        title: "Non-Mutually Exclusive Events A and B",
        href: `${BASE_PATH}/probability/two-events-not-mutually-exclusive`,
      },
    ],
  },
] as const;

export default enMaterials;
