import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Business Entities in Economy",
    description:
      "Powerful organizations that drive economic growth and create jobs worldwide.",
    href: `${BASE_PATH}/business-economy`,
    items: [
      {
        title: "Concept of Business Entity",
        href: `${BASE_PATH}/business-economy/concept-enterprise`,
      },
      {
        title: "State-Owned Enterprises",
        href: `${BASE_PATH}/business-economy/state-owned-enterprise`,
      },
      {
        title: "Local Government Enterprises",
        href: `${BASE_PATH}/business-economy/local-government-enterprise`,
      },
      {
        title: "Private Enterprises",
        href: `${BASE_PATH}/business-economy/private-enterprise`,
      },
      {
        title: "Cooperatives",
        href: `${BASE_PATH}/business-economy/cooperative`,
      },
      {
        title: "Management",
        href: `${BASE_PATH}/business-economy/management`,
      },
    ],
  },
  {
    title: "National Income and Economic Inequality",
    description:
      "Measuring a nation's wealth and understanding why some prosper while others struggle.",
    href: `${BASE_PATH}/national-income-inequality`,
    items: [
      {
        title: "National Income",
        href: `${BASE_PATH}/national-income-inequality/national-income`,
      },
      {
        title: "Economic Inequality",
        href: `${BASE_PATH}/national-income-inequality/economic-inequality`,
      },
    ],
  },
  {
    title: "Employment",
    description:
      "The lifeline connecting people to income, purpose, and economic stability.",
    href: `${BASE_PATH}/employment`,
    items: [
      {
        title: "Employment Concepts",
        href: `${BASE_PATH}/employment/concept`,
      },
      {
        title: "Wage System",
        href: `${BASE_PATH}/employment/wage-system`,
      },
      {
        title: "Unemployment",
        href: `${BASE_PATH}/employment/unemployment`,
      },
    ],
  },
  {
    title: "Money Theory, Price Index and Inflation",
    description:
      "Forces that determine what your money can buy today versus tomorrow.",
    href: `${BASE_PATH}/money-price-inflation`,
    items: [
      {
        title: "Money Demand and Supply",
        href: `${BASE_PATH}/money-price-inflation/demand-supply-money`,
      },
      {
        title: "Price Index",
        href: `${BASE_PATH}/money-price-inflation/price-index`,
      },
      {
        title: "Inflation",
        href: `${BASE_PATH}/money-price-inflation/inflation`,
      },
    ],
  },
  {
    title: "Monetary and Fiscal Policy",
    description:
      "Government's economic toolkit for steering nations through prosperity and crisis.",
    href: `${BASE_PATH}/monetary-fiscal-policy`,
    items: [
      {
        title: "Monetary Policy",
        href: `${BASE_PATH}/monetary-fiscal-policy/monetary-policy`,
      },
      {
        title: "Fiscal Policy",
        href: `${BASE_PATH}/monetary-fiscal-policy/fiscal-policy`,
      },
      {
        title: "Benefits and Impacts of Economic Policy",
        href: `${BASE_PATH}/monetary-fiscal-policy/benefits-impacts`,
      },
      {
        title: "Economic Policy Evaluation",
        href: `${BASE_PATH}/monetary-fiscal-policy/evaluation`,
      },
    ],
  },
] as const;

export default enMaterials;
