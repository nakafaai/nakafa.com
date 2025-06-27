import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Measurement in Scientific Work",
    description:
      "The foundation of all scientific discoveries and modern technology through precise measurement.",
    href: `${BASE_PATH}/measurement`,
    items: [
      {
        title: "Types of Measurement Tools",
        href: `${BASE_PATH}/measurement/tools`,
      },
      {
        title: "Physical Quantities",
        href: `${BASE_PATH}/measurement/quantity`,
      },
      {
        title: "Unit Systems",
        href: `${BASE_PATH}/measurement/unit`,
      },
      {
        title: "Dimensions",
        href: `${BASE_PATH}/measurement/dimension`,
      },
      {
        title: "Significant Figures Rules",
        href: `${BASE_PATH}/measurement/significant-figures`,
      },
      {
        title: "Scientific Notation",
        href: `${BASE_PATH}/measurement/notation`,
      },
      {
        title: "Uncertainty in Repeated Measurements",
        href: `${BASE_PATH}/measurement/uncertainty`,
      },
    ],
  },
  {
    title: "Renewable Energy",
    description:
      "The key to our planet's future with clean energy that never runs out for generations to come.",
    href: `${BASE_PATH}/renewable-energy`,
    items: [
      {
        title: "Energy Concept",
        href: `${BASE_PATH}/renewable-energy/energy`,
      },
      {
        title: "Forms of Energy",
        href: `${BASE_PATH}/renewable-energy/energy-forms`,
      },
      {
        title: "Law of Energy Conservation",
        href: `${BASE_PATH}/renewable-energy/energy-conservation`,
      },
      {
        title: "Energy Transformation",
        href: `${BASE_PATH}/renewable-energy/energy-transformation`,
      },
      {
        title: "Urgency of Energy Demand Issues",
        href: `${BASE_PATH}/renewable-energy/energy-urgency`,
      },
      {
        title: "Energy Sources",
        href: `${BASE_PATH}/renewable-energy/energy-sources`,
      },
      {
        title: "Renewable Energy Sources",
        href: `${BASE_PATH}/renewable-energy/renewable-sources`,
      },
      {
        title: "Non-renewable Energy Sources",
        href: `${BASE_PATH}/renewable-energy/non-renewable-sources`,
      },
      {
        title: "Impact of Energy Exploration and Use",
        href: `${BASE_PATH}/renewable-energy/energy-impact`,
      },
      {
        title: "Solutions to Meet Energy Demands",
        href: `${BASE_PATH}/renewable-energy/energy-solutions`,
      },
    ],
  },
] as const;

export default enMaterials;
