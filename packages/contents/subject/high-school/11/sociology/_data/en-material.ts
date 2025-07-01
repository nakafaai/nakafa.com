import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Social Groups",
    description:
      "Human networks that shape identity and determine our place in the world.",
    href: `${BASE_PATH}/social-groups`,
    items: [
      {
        title: "Groups and Social Classification",
        href: `${BASE_PATH}/social-groups/classification`,
      },
      {
        title: "Variety of Social Groups",
        href: `${BASE_PATH}/social-groups/variety`,
      },
      {
        title: "Social Group Dynamics",
        href: `${BASE_PATH}/social-groups/dynamics`,
      },
    ],
  },
  {
    title: "Social Problems Due to Social Grouping",
    description:
      "Complex challenges arising when group differences create tension and division.",
    href: `${BASE_PATH}/social-problems`,
    items: [
      {
        title: "Social Problems Related to Social Grouping",
        href: `${BASE_PATH}/social-problems/classification`,
      },
      {
        title: "Variety of Social Problems Related to Social Grouping",
        href: `${BASE_PATH}/social-problems/variety`,
      },
      {
        title: "Research-Based Social Problem Solving",
        href: `${BASE_PATH}/social-problems/research-based-problem-solving`,
      },
    ],
  },
  {
    title: "Social Conflicts",
    description:
      "Clashes of interests that can either destroy or strengthen societal bonds.",
    href: `${BASE_PATH}/social-conflicts`,
    items: [
      {
        title: "Social Conflict Concepts",
        href: `${BASE_PATH}/social-conflicts/concept`,
      },
      {
        title: "Conflict Resolution for Creating Peace",
        href: `${BASE_PATH}/social-conflicts/conflict-resolution`,
      },
      {
        title: "Research-Based Conflict Resolution",
        href: `${BASE_PATH}/social-conflicts/research-based-conflict-resolution`,
      },
    ],
  },
  {
    title: "Building Social Harmony",
    description:
      "The art of creating beautiful balance within complex and diverse societies.",
    href: `${BASE_PATH}/social-harmony`,
    items: [
      {
        title: "Principles in Building Social Harmony",
        href: `${BASE_PATH}/social-harmony/principles`,
      },
      {
        title: "Efforts to Build Social Harmony",
        href: `${BASE_PATH}/social-harmony/efforts`,
      },
      {
        title: "Designing Actions to Build Social Harmony",
        href: `${BASE_PATH}/social-harmony/action-planning`,
      },
    ],
  },
] as const;

export default enMaterials;
