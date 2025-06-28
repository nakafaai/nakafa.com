import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Viruses and Their Role",
    description:
      "Microscopic organisms changing the world from diseases to future gene therapy.",
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
      "The wonder of life on Earth from microscopic bacteria to tropical rainforests.",
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
      "The greatest global challenge affecting the future of our planet and life.",
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
] as const;

export default enMaterials;
