import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Enzymes and Metabolism",
    description:
      "Biological catalysts driving all life reactions from digestion to respiration.",
    href: `${BASE_PATH}/enzyme-metabolism`,
    items: [
      {
        title: "Enzymes",
        href: `${BASE_PATH}/enzyme-metabolism/enzyme`,
      },
      {
        title: "Metabolism",
        href: `${BASE_PATH}/enzyme-metabolism/metabolism`,
      },
    ],
  },
  {
    title: "Genetics and Inheritance",
    description:
      "Life's code determining eye color, height, and all hereditary traits.",
    href: `${BASE_PATH}/genetic-inheritance`,
    items: [
      {
        title: "Genetic Material",
        href: `${BASE_PATH}/genetic-inheritance/genetic-material`,
      },
      {
        title: "Protein Synthesis",
        href: `${BASE_PATH}/genetic-inheritance/protein-synthesis`,
      },
      {
        title: "Cell Division",
        href: `${BASE_PATH}/genetic-inheritance/cell-division`,
      },
      {
        title: "Inheritance",
        href: `${BASE_PATH}/genetic-inheritance/inheritance`,
      },
    ],
  },
  {
    title: "Evolution",
    description:
      "Spectacular journey of life from simple organisms to modern diversity.",
    href: `${BASE_PATH}/evolution`,
    items: [
      {
        title: "Definition of Evolution",
        href: `${BASE_PATH}/evolution/definition`,
      },
      {
        title: "Development of Evolution Theory",
        href: `${BASE_PATH}/evolution/development-theory`,
      },
    ],
  },
  {
    title: "Biotechnology Innovation",
    description:
      "Scientific revolution producing medicines, vaccines, and future solutions.",
    href: `${BASE_PATH}/biotechnology-innovation`,
    items: [
      {
        title: "Definition of Biotechnology",
        href: `${BASE_PATH}/biotechnology-innovation/definition`,
      },
      {
        title: "Benefits of Biotechnology",
        href: `${BASE_PATH}/biotechnology-innovation/benefit`,
      },
      {
        title: "Types of Biotechnology",
        href: `${BASE_PATH}/biotechnology-innovation/type`,
      },
      {
        title: "Scientific Branches in Biotechnology",
        href: `${BASE_PATH}/biotechnology-innovation/branch`,
      },
      {
        title: "Conventional Biotechnology Applications",
        href: `${BASE_PATH}/biotechnology-innovation/conventional-application`,
      },
      {
        title: "Modern Biotechnology Applications",
        href: `${BASE_PATH}/biotechnology-innovation/modern-application`,
      },
      {
        title: "Expectations and Reality of Modern Biotechnology",
        href: `${BASE_PATH}/biotechnology-innovation/modern-reality`,
      },
      {
        title: "Bioethics",
        href: `${BASE_PATH}/biotechnology-innovation/bioethics`,
      },
    ],
  },
] as const;

export default enMaterials;
