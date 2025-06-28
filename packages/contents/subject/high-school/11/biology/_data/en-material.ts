import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Exploring Cells",
    description:
      "Basic unit of life controlling all processes from metabolism to reproduction.",
    href: `${BASE_PATH}/explore-cell`,
    items: [
      {
        title: "What is a Cell?",
        href: `${BASE_PATH}/explore-cell/what-is-cell`,
      },
      {
        title: "Cell Structure",
        href: `${BASE_PATH}/explore-cell/structure-cell`,
      },
      {
        title: "Relationship between Cell Structure and Function",
        href: `${BASE_PATH}/explore-cell/structure-function-relationship`,
      },
      {
        title: "Cell Composition",
        href: `${BASE_PATH}/explore-cell/composition-cell`,
      },
    ],
  },
  {
    title: "Movement of Substances through Cell Membrane",
    description:
      "Vital mechanism regulating molecular entry and exit for cell survival.",
    href: `${BASE_PATH}/cell-membrane`,
    items: [
      {
        title: "Passive Transport",
        href: `${BASE_PATH}/cell-membrane/passive-transport`,
      },
      {
        title: "Active Transport",
        href: `${BASE_PATH}/cell-membrane/active-transport`,
      },
    ],
  },
  {
    title: "Regulation Processes in Plants",
    description:
      "Complex systems enabling plants to grow, reproduce, and adapt.",
    href: `${BASE_PATH}/plant-regulation`,
    items: [
      {
        title: "Tissues",
        href: `${BASE_PATH}/plant-regulation/tissue`,
      },
      {
        title: "Organs",
        href: `${BASE_PATH}/plant-regulation/organ`,
      },
      {
        title: "Organ Systems",
        href: `${BASE_PATH}/plant-regulation/organ-system`,
      },
      {
        title: "Transport in Plants",
        href: `${BASE_PATH}/plant-regulation/transport`,
      },
      {
        title: "Plant Reproduction",
        href: `${BASE_PATH}/plant-regulation/reproduction`,
      },
      {
        title: "Plant Irritability",
        href: `${BASE_PATH}/plant-regulation/irritability`,
      },
    ],
  },
  {
    title: "Transport and Exchange of Substances in Humans",
    description:
      "Advanced transport network delivering oxygen and nutrients throughout the body.",
    href: `${BASE_PATH}/human-exchange`,
    items: [
      {
        title: "Body Structure for Substance Exchange and Transport",
        href: `${BASE_PATH}/human-exchange/body-structure`,
      },
      {
        title: "Substance Exchange and Transport Processes",
        href: `${BASE_PATH}/human-exchange/exchange-transport`,
      },
      {
        title: "Abnormalities in Substance Exchange and Transport",
        href: `${BASE_PATH}/human-exchange/abnormalities`,
      },
    ],
  },
  {
    title: "Body Defense System against Disease",
    description:
      "Elite body forces fighting bacteria, viruses, and other health threats.",
    href: `${BASE_PATH}/human-defense`,
    items: [
      {
        title: "External and Internal Defense Systems",
        href: `${BASE_PATH}/human-defense/external-internal-defense`,
      },
      {
        title: "Components of Body Defense System",
        href: `${BASE_PATH}/human-defense/components`,
      },
      {
        title: "Body Immunity and Its Disorders",
        href: `${BASE_PATH}/human-defense/immunity`,
      },
    ],
  },
  {
    title: "Human Mobility",
    description:
      "Perfect coordination between brain, nerves, and muscles for every body movement.",
    href: `${BASE_PATH}/human-mobility`,
    items: [
      {
        title: "Nervous System Structure",
        href: `${BASE_PATH}/human-mobility/nervous-system`,
      },
      {
        title: "Nervous System Function",
        href: `${BASE_PATH}/human-mobility/nervous-system-function`,
      },
      {
        title: "Muscular System Structure",
        href: `${BASE_PATH}/human-mobility/muscular-system`,
      },
      {
        title: "Muscular System Function",
        href: `${BASE_PATH}/human-mobility/muscular-system-function`,
      },
      {
        title: "Muscular System Abnormalities",
        href: `${BASE_PATH}/human-mobility/muscular-system-abnormalities`,
      },
      {
        title: "Relationship between Nervous and Muscular Systems",
        href: `${BASE_PATH}/human-mobility/nervous-muscular-relationship`,
      },
    ],
  },
  {
    title: "Hormones in Human Reproduction",
    description:
      "Chemical messengers controlling sexual development and human reproductive cycles.",
    href: `${BASE_PATH}/reproduction-hormone`,
    items: [
      {
        title: "Endocrine Gland Structure",
        href: `${BASE_PATH}/reproduction-hormone/endocrine-gland`,
      },
      {
        title: "Endocrine Gland Function",
        href: `${BASE_PATH}/reproduction-hormone/endocrine-gland-function`,
      },
      {
        title: "Role of Hormones in Reproduction",
        href: `${BASE_PATH}/reproduction-hormone/hormone-function`,
      },
      {
        title: "Relationship of Organ Structure in Reproductive System",
        href: `${BASE_PATH}/reproduction-hormone/organ-relationship`,
      },
    ],
  },
  {
    title: "Growth and Development of Living Organisms",
    description:
      "Amazing process of organism transformation from birth to maturity.",
    href: `${BASE_PATH}/growth-development`,
    items: [
      {
        title: "Growth Phenomena",
        href: `${BASE_PATH}/growth-development/growth-phenomena`,
      },
      {
        title: "Development Phenomena",
        href: `${BASE_PATH}/growth-development/development-phenomena`,
      },
      {
        title: "Factors Affecting Growth",
        href: `${BASE_PATH}/growth-development/growth-factors`,
      },
      {
        title: "Factors Affecting Development",
        href: `${BASE_PATH}/growth-development/development-factors`,
      },
    ],
  },
] as const;

export default enMaterials;
