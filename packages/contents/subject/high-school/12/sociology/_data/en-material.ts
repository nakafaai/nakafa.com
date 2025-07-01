import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Social Change",
    description:
      "Unstoppable force transforming human lifestyles from generation to generation.",
    href: `${BASE_PATH}/social-change`,
    items: [
      {
        title: "Understanding Social Change",
        href: `${BASE_PATH}/social-change/understanding`,
      },
      {
        title: "Social Change Theories",
        href: `${BASE_PATH}/social-change/theories`,
      },
      {
        title: "Forms of Social Change",
        href: `${BASE_PATH}/social-change/forms`,
      },
      {
        title: "Impact of Social Change",
        href: `${BASE_PATH}/social-change/impact`,
      },
    ],
  },
  {
    title: "Globalization and Digital Society",
    description:
      "Connectivity revolution uniting the world in one giant digital network.",
    href: `${BASE_PATH}/globalization-digital`,
    items: [
      {
        title: "Understanding Globalization",
        href: `${BASE_PATH}/globalization-digital/globalization`,
      },
      {
        title: "Digital Society Development",
        href: `${BASE_PATH}/globalization-digital/digital-development`,
      },
      {
        title: "Society's Response to Globalization and Digital Era",
        href: `${BASE_PATH}/globalization-digital/society-response`,
      },
    ],
  },
  {
    title: "Social Problems Due to Globalization and Digital Era",
    description:
      "New challenges emerging from technological advancement and global connectivity.",
    href: `${BASE_PATH}/global-digital-problems`,
    items: [
      {
        title: "Causes of Social Problems Due to Globalization and Digital Era",
        href: `${BASE_PATH}/global-digital-problems/causes`,
      },
      {
        title:
          "Variety of Social Problems Due to Globalization and Digital Era",
        href: `${BASE_PATH}/global-digital-problems/variety`,
      },
      {
        title:
          "Efforts to Overcome Problems Due to Globalization and Digital Era",
        href: `${BASE_PATH}/global-digital-problems/solutions`,
      },
    ],
  },
  {
    title: "Community Empowerment Based on Local Wisdom",
    description:
      "Harnessing traditional strength to build a sustainable future.",
    href: `${BASE_PATH}/local-empowerment`,
    items: [
      {
        title: "Empowerment and Local Wisdom Potential",
        href: `${BASE_PATH}/local-empowerment/potential`,
      },
      {
        title: "Various Community Empowerment Actions",
        href: `${BASE_PATH}/local-empowerment/actions`,
      },
      {
        title: "Stages of Local Community Empowerment",
        href: `${BASE_PATH}/local-empowerment/steps`,
      },
    ],
  },
] as const;

export default enMaterials;
