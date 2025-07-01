import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Introduction to Historical Studies",
    description:
      "Time journey revealing past secrets to understand the present moment.",
    href: `${BASE_PATH}/history-introduction`,
    items: [
      {
        title: "Historical Concepts",
        href: `${BASE_PATH}/history-introduction/concept`,
      },
      {
        title: "Why Do We Need to Study History?",
        href: `${BASE_PATH}/history-introduction/why-study-history`,
      },
      {
        title: "Humans, Space, and Time in History",
        href: `${BASE_PATH}/history-introduction/human-space-time`,
      },
    ],
  },
  {
    title: "Historical Research",
    description:
      "Detective art of the past searching for truth from remaining traces.",
    href: `${BASE_PATH}/history-research`,
    items: [
      {
        title: "Primary Historical Sources",
        href: `${BASE_PATH}/history-research/primary-sources`,
      },
      {
        title: "Secondary Historical Sources",
        href: `${BASE_PATH}/history-research/secondary-sources`,
      },
    ],
  },
  {
    title: "Historical Writing",
    description:
      "Skill of narrating the past objectively and convincingly for future generations.",
    href: `${BASE_PATH}/history-writing`,
    items: [
      {
        title: "What is Historiography?",
        href: `${BASE_PATH}/history-writing/historiography`,
      },
      {
        title: "Avoiding Historical Bias",
        href: `${BASE_PATH}/history-writing/avoiding-bias`,
      },
      {
        title: "How to Conduct Historical Research and Writing?",
        href: `${BASE_PATH}/history-writing/how-history-research`,
      },
    ],
  },
] as const;

export default enMaterials;
