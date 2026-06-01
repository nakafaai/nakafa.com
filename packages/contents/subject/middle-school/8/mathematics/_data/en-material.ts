import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from "@repo/contents/subject/middle-school/8/mathematics/_data/path";

const enMaterials = [
  {
    title: "Exponents",
    description:
      "Read powers, radicals, scientific notation, and exponent rules from repeated multiplication.",
    href: `${BASE_PATH}/exponents`,
    items: [
      {
        title: "Understanding Exponents",
        href: `${BASE_PATH}/exponents/understanding`,
      },
      {
        title: "Multiplication Properties of Exponents",
        href: `${BASE_PATH}/exponents/multiplication-props`,
      },
      {
        title: "Power Properties of Exponents",
        href: `${BASE_PATH}/exponents/power-props`,
      },
      {
        title: "Power of a Product",
        href: `${BASE_PATH}/exponents/product-power`,
      },
      {
        title: "Zero and Negative Exponents",
        href: `${BASE_PATH}/exponents/zero-negative`,
      },
      {
        title: "Fractional Exponents",
        href: `${BASE_PATH}/exponents/fractional`,
      },
      {
        title: "Converting Fractional Exponents to Radicals",
        href: `${BASE_PATH}/exponents/fraction-radical`,
      },
      {
        title: "Addition and Subtraction of Radicals",
        href: `${BASE_PATH}/exponents/radical-add-sub`,
      },
      {
        title: "Multiplication of Radicals",
        href: `${BASE_PATH}/exponents/radical-mult`,
      },
      {
        title: "Division of Radicals",
        href: `${BASE_PATH}/exponents/radical-div`,
      },
      {
        title: "Rationalizing the Denominator",
        href: `${BASE_PATH}/exponents/rationalizing`,
      },
      {
        title: "Scientific Notation",
        href: `${BASE_PATH}/exponents/scientific-notation`,
      },
    ],
  },
  {
    title: "Pythagorean Theorem",
    description:
      "Connect right-triangle side lengths, the converse theorem, distance, and applications.",
    href: `${BASE_PATH}/pythagorean-theorem`,
    items: [
      {
        title: "Discovering Pythagorean Concept",
        href: `${BASE_PATH}/pythagorean-theorem/concept`,
      },
      {
        title: "Right-Angled Triangles",
        href: `${BASE_PATH}/pythagorean-theorem/right-triangle`,
      },
      {
        title: "Pythagorean Theorem",
        href: `${BASE_PATH}/pythagorean-theorem/theorem`,
      },
      {
        title: "Converse of Pythagorean Theorem",
        href: `${BASE_PATH}/pythagorean-theorem/converse`,
      },
      {
        title: "Special Triangles",
        href: `${BASE_PATH}/pythagorean-theorem/special-triangles`,
      },
      {
        title: "Applications of Pythagorean Theorem",
        href: `${BASE_PATH}/pythagorean-theorem/applications`,
      },
      {
        title: "Distance Formula",
        href: `${BASE_PATH}/pythagorean-theorem/distance`,
      },
    ],
  },
  {
    title: "Linear Equations and Inequalities of One Variable",
    description:
      "Build open sentences, equations, and one-variable inequalities through complete solving steps.",
    href: `${BASE_PATH}/linear-equations-inequalities`,
    items: [
      {
        title: "Concept of Linear Equations",
        href: `${BASE_PATH}/linear-equations-inequalities/equation-concept`,
      },
      {
        title: "Open and Closed Sentences",
        href: `${BASE_PATH}/linear-equations-inequalities/open-closed`,
      },
      {
        title: "General Form of Linear Equations",
        href: `${BASE_PATH}/linear-equations-inequalities/general-form`,
      },
      {
        title: "Solving Linear Equations",
        href: `${BASE_PATH}/linear-equations-inequalities/solving-equations`,
      },
      {
        title: "Concept of Linear Inequalities",
        href: `${BASE_PATH}/linear-equations-inequalities/inequality-concept`,
      },
      {
        title: "Solving Linear Inequalities Problems",
        href: `${BASE_PATH}/linear-equations-inequalities/solving-inequalities`,
      },
    ],
  },
  {
    title: "Relations and Functions",
    description:
      "Distinguish sets, relations, functions, one-to-one correspondences, and their representations.",
    href: `${BASE_PATH}/relations-functions`,
    items: [
      {
        title: "Set Definition",
        href: `${BASE_PATH}/relations-functions/set-definition`,
      },
      {
        title: "Set Representation",
        href: `${BASE_PATH}/relations-functions/set-representation`,
      },
      {
        title: "Relation Definition",
        href: `${BASE_PATH}/relations-functions/relation-definition`,
      },
      {
        title: "Relation Representation",
        href: `${BASE_PATH}/relations-functions/relation-representation`,
      },
      {
        title: "Function Characteristics",
        href: `${BASE_PATH}/relations-functions/function-characteristics`,
      },
      {
        title: "Function Features",
        href: `${BASE_PATH}/relations-functions/function-features`,
      },
      {
        title: "Counting Possible Functions",
        href: `${BASE_PATH}/relations-functions/counting-functions`,
      },
      {
        title: "Function Forms",
        href: `${BASE_PATH}/relations-functions/function-forms`,
      },
      {
        title: "Function Values and Forms",
        href: `${BASE_PATH}/relations-functions/function-values`,
      },
      {
        title: "One-to-One Correspondence Definition",
        href: `${BASE_PATH}/relations-functions/one-to-one-def`,
      },
      {
        title: "Counting One-to-One Correspondence",
        href: `${BASE_PATH}/relations-functions/counting-one-to-one`,
      },
    ],
  },
  {
    title: "Straight Line Equations",
    description:
      "Read line graphs, slopes, points, and line equations on the coordinate plane.",
    href: `${BASE_PATH}/straight-line-equations`,
    items: [
      {
        title: "Graphing Straight Lines",
        href: `${BASE_PATH}/straight-line-equations/line-graph`,
      },
      {
        title: "Slope Definition",
        href: `${BASE_PATH}/straight-line-equations/slope-definition`,
      },
      {
        title: "Finding Slope",
        href: `${BASE_PATH}/straight-line-equations/finding-slope`,
      },
      {
        title: "Finding Equation from Slope and Point",
        href: `${BASE_PATH}/straight-line-equations/finding-equation`,
      },
    ],
  },
  {
    title: "Statistics",
    description:
      "Read center, range, quartiles, and data spread before drawing conclusions.",
    href: `${BASE_PATH}/statistics`,
    items: [
      {
        title: "Data Centrality",
        href: `${BASE_PATH}/statistics/centrality`,
      },
      {
        title: "Mode",
        href: `${BASE_PATH}/statistics/mode`,
      },
      {
        title: "Median",
        href: `${BASE_PATH}/statistics/median`,
      },
      {
        title: "Median with Odd Data",
        href: `${BASE_PATH}/statistics/median-odd`,
      },
      {
        title: "Median with Even Data",
        href: `${BASE_PATH}/statistics/median-even`,
      },
      {
        title: "Median with Random Heterogeneous Data",
        href: `${BASE_PATH}/statistics/median-random`,
      },
      {
        title: "Mean",
        href: `${BASE_PATH}/statistics/mean`,
      },
      {
        title: "Range",
        href: `${BASE_PATH}/statistics/range`,
      },
      {
        title: "Quartiles",
        href: `${BASE_PATH}/statistics/quartiles`,
      },
      {
        title: "Quartile Range and Deviation",
        href: `${BASE_PATH}/statistics/quartile-range`,
      },
    ],
  },
] satisfies MaterialList;

export default enMaterials;
