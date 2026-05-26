import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from "@repo/contents/subject/high-school/10/biology/_data/path";

const enMaterials = [
  {
    title: "Viruses and Their Role",
    description:
      "Virus structure, replication, roles, and prevention across cells, bodies, and environments.",
    href: `${BASE_PATH}/virus-role`,
    items: [
      {
        title: "What is a Virus?",
        href: `${BASE_PATH}/virus-role/what-is-virus`,
      },
      {
        title: "How Do Viruses Reproduce?",
        href: `${BASE_PATH}/virus-role/how-virus-reproduce`,
      },
      {
        title: "Role of Viruses",
        href: `${BASE_PATH}/virus-role/role`,
      },
      {
        title: "Ways to Prevent Virus Spread",
        href: `${BASE_PATH}/virus-role/prevent-virus-spread`,
      },
    ],
  },
  {
    title: "Biodiversity of Living Organisms",
    description:
      "Biodiversity levels, classification, bacteria, fungi, and organism relationships in ecosystems.",
    href: `${BASE_PATH}/biodiversity`,
    items: [
      {
        title: "Biological Diversity",
        href: `${BASE_PATH}/biodiversity/levels`,
      },
      {
        title: "Classification of Living Organisms",
        href: `${BASE_PATH}/biodiversity/classification`,
      },
      {
        title: "Bacteria",
        href: `${BASE_PATH}/biodiversity/bacteria`,
      },
      {
        title: "Fungi",
        href: `${BASE_PATH}/biodiversity/fungi`,
      },
      {
        title: "Living Organisms in Ecosystems",
        href: `${BASE_PATH}/biodiversity/living-organisms`,
      },
    ],
  },
  {
    title: "Climate Change",
    description:
      "Climate symptoms, impacts, causes, mitigation, adaptation, and data-backed cooperation.",
    href: `${BASE_PATH}/climate-change`,
    items: [
      {
        title: "Symptoms of Climate Change",
        href: `${BASE_PATH}/climate-change/symptoms`,
      },
      {
        title: "Impact of Climate Change",
        href: `${BASE_PATH}/climate-change/impact`,
      },
      {
        title: "Causes of Climate Change",
        href: `${BASE_PATH}/climate-change/causes`,
      },
      {
        title: "Mitigation and Adaptation Efforts for Climate Change",
        href: `${BASE_PATH}/climate-change/mitigation-adaptation`,
      },
      {
        title: "Global Cooperation to Address Climate Change",
        href: `${BASE_PATH}/climate-change/global-cooperation`,
      },
    ],
  },
] satisfies MaterialList;

export default enMaterials;
