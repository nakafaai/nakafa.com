import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from "@repo/contents/subject/high-school/12/sociology/_data/path";

const enMaterials = [
  {
    title: "Social Change",
    description:
      "How societies change over time and how those changes affect daily life.",
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
      "How global connections and digital technology shape social life.",
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
    description: "How local wisdom can guide community empowerment.",
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
] satisfies MaterialList;

export default enMaterials;
