import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Integers",
    description: "Calculation basis for everything in the world.",
    href: `${BASE_PATH}/integers`,
    items: [
      {
        title: "What are Integers?",
        href: `${BASE_PATH}/integers/what-is-integer`,
      },
      {
        title: "Comparing Integers",
        href: `${BASE_PATH}/integers/comparing-integers`,
      },
      {
        title: "Integer Addition and Subtraction",
        href: `${BASE_PATH}/integers/addition-subtraction`,
      },
      {
        title: "Integer Multiplication and Division",
        href: `${BASE_PATH}/integers/multiplication-division`,
      },
      {
        title: "Positive and Negative Factors",
        href: `${BASE_PATH}/integers/positive-negative-factors`,
      },
      {
        title: "Greatest Common Divisor",
        href: `${BASE_PATH}/integers/greatest-common-divisor`,
      },
      {
        title: "Least Common Multiple",
        href: `${BASE_PATH}/integers/least-common-multiple`,
      },
    ],
  },
  {
    title: "Rational Numbers",
    description: "Number precision in fractions and decimals.",
    href: `${BASE_PATH}/rational-numbers`,
    items: [
      {
        title: "What are Rational Numbers?",
        href: `${BASE_PATH}/rational-numbers/what-is-rational`,
      },
      {
        title: "Rationals as Fractions and Decimals",
        href: `${BASE_PATH}/rational-numbers/fractions-and-decimals`,
      },
      {
        title: "Comparing Rational Numbers",
        href: `${BASE_PATH}/rational-numbers/comparing-rationals`,
      },
      {
        title: "Fraction Addition and Subtraction",
        href: `${BASE_PATH}/rational-numbers/fraction-addition-subtraction`,
      },
      {
        title: "Decimal Addition and Subtraction",
        href: `${BASE_PATH}/rational-numbers/decimal-addition-subtraction`,
      },
      {
        title: "Mixed Form Addition and Subtraction",
        href: `${BASE_PATH}/rational-numbers/mixed-addition-subtraction`,
      },
      {
        title: "Fraction Multiplication",
        href: `${BASE_PATH}/rational-numbers/fraction-multiplication`,
      },
      {
        title: "Decimal Multiplication and Division",
        href: `${BASE_PATH}/rational-numbers/decimal-multiplication-division`,
      },
      {
        title: "Mixed Form Multiplication and Division",
        href: `${BASE_PATH}/rational-numbers/mixed-multiplication-division`,
      },
    ],
  },
  {
    title: "Ratio",
    description: "Understanding proportion and value comparison.",
    href: `${BASE_PATH}/ratio`,
    items: [
      {
        title: "What is Ratio?",
        href: `${BASE_PATH}/ratio/what-is-ratio`,
      },
      {
        title: "Ratio vs Fraction",
        href: `${BASE_PATH}/ratio/ratio-vs-fraction`,
      },
      {
        title: "Scale and Equivalent Ratios",
        href: `${BASE_PATH}/ratio/scale-equivalent-ratio`,
      },
      {
        title: "Unit Rate of Change",
        href: `${BASE_PATH}/ratio/unit-rate-change`,
      },
    ],
  },
  {
    title: "Algebraic Forms",
    description: "Symbolic language for complex problem solving.",
    href: `${BASE_PATH}/algebraic-forms`,
    items: [
      {
        title: "Algebraic Elements",
        href: `${BASE_PATH}/algebraic-forms/algebraic-elements`,
      },
      {
        title: "Algebraic Properties",
        href: `${BASE_PATH}/algebraic-forms/algebraic-properties`,
      },
      {
        title: "Algebraic Operations",
        href: `${BASE_PATH}/algebraic-forms/algebraic-operations`,
      },
      {
        title: "Algebraic Modeling",
        href: `${BASE_PATH}/algebraic-forms/algebraic-modeling`,
      },
    ],
  },
  {
    title: "Similarity",
    description: "Scale geometry in maps and design.",
    href: `${BASE_PATH}/similarity`,
    items: [
      {
        title: "Angle Relationships",
        href: `${BASE_PATH}/similarity/angle-relationships`,
      },
      {
        title: "Intersection Angles",
        href: `${BASE_PATH}/similarity/intersection-angles`,
      },
      {
        title: "Meaning of Similarity",
        href: `${BASE_PATH}/similarity/meaning-of-similarity`,
      },
      {
        title: "Enlargement and Reduction",
        href: `${BASE_PATH}/similarity/enlargement-and-reduction`,
      },
      {
        title: "Triangle Similarity",
        href: `${BASE_PATH}/similarity/triangle-similarity`,
      },
      {
        title: "Proportional Scaling",
        href: `${BASE_PATH}/similarity/proportional-scaling`,
      },
    ],
  },
  {
    title: "Data and Diagrams",
    description: "Turning numbers into visual stories.",
    href: `${BASE_PATH}/data-diagrams`,
    items: [
      {
        title: "Statistical Investigation",
        href: `${BASE_PATH}/data-diagrams/statistical-investigation`,
      },
      {
        title: "Data Handling Cycle",
        href: `${BASE_PATH}/data-diagrams/data-handling-cycle`,
      },
      {
        title: "Types of Data",
        href: `${BASE_PATH}/data-diagrams/types-of-data`,
      },
      {
        title: "Distinguishing Data Types",
        href: `${BASE_PATH}/data-diagrams/distinguishing-data`,
      },
      {
        title: "Statistical Diagrams",
        href: `${BASE_PATH}/data-diagrams/statistical-diagrams`,
      },
      {
        title: "Reading and Interpreting Diagrams",
        href: `${BASE_PATH}/data-diagrams/reading-diagrams`,
      },
      {
        title: "Bar Charts",
        href: `${BASE_PATH}/data-diagrams/bar-charts`,
      },
      {
        title: "Creating Bar Charts",
        href: `${BASE_PATH}/data-diagrams/creating-bar-charts`,
      },
      {
        title: "Pie Charts",
        href: `${BASE_PATH}/data-diagrams/pie-charts`,
      },
      {
        title: "Pie Chart Percentages",
        href: `${BASE_PATH}/data-diagrams/pie-chart-percentages`,
      },
      {
        title: "Choosing the Right Diagram",
        href: `${BASE_PATH}/data-diagrams/choosing-diagrams`,
      },
    ],
  },
] as const;

export default enMaterials;
