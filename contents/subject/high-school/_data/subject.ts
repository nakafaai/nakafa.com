import { getMaterialIcon } from "@/lib/utils/subject/material";

const BASE_PATH = "/subject/high-school";

export function getSubjects(grade: number) {
  return [
    {
      icon: getMaterialIcon("mathematics"),
      label: "mathematics",
      href: `${BASE_PATH}/${grade}/mathematics`,
    },
  ] as const;
}

export const grade10Subjects = getSubjects(10);

export const grade11Subjects = getSubjects(11);

export const grade12Subjects = getSubjects(12);

export const seniorHighSchoolSubjects = {
  grade10: grade10Subjects,
  grade11: grade11Subjects,
  grade12: grade12Subjects,
} as const;
