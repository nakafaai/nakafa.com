import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Economic Growth and Development",
    description:
      "The engine transforming societies from poverty to prosperity in the digital age.",
    href: `${BASE_PATH}/growth-development`,
    items: [
      {
        title: "Economic Growth",
        href: `${BASE_PATH}/growth-development/economic-growth`,
      },
      {
        title: "Economic Development",
        href: `${BASE_PATH}/growth-development/economic-development`,
      },
      {
        title: "Digital Economy",
        href: `${BASE_PATH}/growth-development/digital-economy`,
      },
    ],
  },
  {
    title: "International Economy",
    description:
      "Global economic web connecting nations through trade, cooperation, and competition.",
    href: `${BASE_PATH}/international-economy`,
    items: [
      {
        title: "International Trade Concept",
        href: `${BASE_PATH}/international-economy/concept-trade`,
      },
      {
        title: "Benefits of International Trade",
        href: `${BASE_PATH}/international-economy/benefits-trade`,
      },
      {
        title: "Promoting Factors of International Trade",
        href: `${BASE_PATH}/international-economy/promoting-factors-trade`,
      },
      {
        title: "Limiting Factors of International Trade",
        href: `${BASE_PATH}/international-economy/limiting-factors-trade`,
      },
      {
        title: "International Trade Theory",
        href: `${BASE_PATH}/international-economy/theory-trade`,
      },
      {
        title: "International Trade Policy",
        href: `${BASE_PATH}/international-economy/policy-trade`,
      },
      {
        title: "Balance of Payments",
        href: `${BASE_PATH}/international-economy/balance-payment`,
      },
      {
        title: "International Economic Cooperation",
        href: `${BASE_PATH}/international-economy/economic-cooperation`,
      },
    ],
  },
  {
    title: "State and Regional Budget",
    description:
      "Financial blueprint determining public services, infrastructure, and national priorities.",
    href: `${BASE_PATH}/apbn-apbd`,
    items: [
      {
        title: "State Budget (APBN)",
        href: `${BASE_PATH}/apbn-apbd/apbn`,
      },
      {
        title: "Regional Budget (APBD)",
        href: `${BASE_PATH}/apbn-apbd/apbd`,
      },
      {
        title: "Taxation",
        href: `${BASE_PATH}/apbn-apbd/taxation`,
      },
    ],
  },
  {
    title: "Accounting",
    description:
      "Business language revealing financial health and guiding smart decisions.",
    href: `${BASE_PATH}/accounting`,
    items: [
      {
        title: "Basic Accounting Equation",
        href: `${BASE_PATH}/accounting/accounting-equation`,
      },
      {
        title: "Financial Reports",
        href: `${BASE_PATH}/accounting/financial-report`,
      },
    ],
  },
] as const;

export default enMaterials;
