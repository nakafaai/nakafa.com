import { getMaterialIcon } from "@/lib/utils/subject/material";

const BASE_PATH = "/subject/high-school";

export function getSubjects(grade: number) {
  return [
    {
      icon: getMaterialIcon("mathematics"),
      label: "mathematics",
      href: `${BASE_PATH}/${grade}/mathematics`,
    },
    {
      icon: getMaterialIcon("physics"),
      label: "physics",
      href: `${BASE_PATH}/${grade}/physics`,
    },
    {
      icon: getMaterialIcon("chemistry"),
      label: "chemistry",
      href: `${BASE_PATH}/${grade}/chemistry`,
    },
    {
      icon: getMaterialIcon("biology"),
      label: "biology",
      href: `${BASE_PATH}/${grade}/biology`,
    },
    {
      icon: getMaterialIcon("geography"),
      label: "geography",
      href: `${BASE_PATH}/${grade}/geography`,
    },
    {
      icon: getMaterialIcon("economy"),
      label: "economy",
      href: `${BASE_PATH}/${grade}/economy`,
    },
    {
      icon: getMaterialIcon("history"),
      label: "history",
      href: `${BASE_PATH}/${grade}/history`,
    },
    {
      icon: getMaterialIcon("informatics"),
      label: "informatics",
      href: `${BASE_PATH}/${grade}/informatics`,
    },
    {
      icon: getMaterialIcon("geospatial"),
      label: "geospatial",
      href: `${BASE_PATH}/${grade}/geospatial`,
    },
  ] as const;
}
