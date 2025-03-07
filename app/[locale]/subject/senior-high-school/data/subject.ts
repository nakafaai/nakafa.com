import {
  DraftingCompassIcon,
  FlaskConicalIcon,
  PawPrintIcon,
  PiIcon,
} from "lucide-react";

function getSubjects(grade: number) {
  return [
    {
      icon: PiIcon,
      label: "mathematics",
      href: `/subject/senior-high-school/${grade}/mathematics`,
    },
    {
      icon: DraftingCompassIcon,
      label: "physics",
      href: `/subject/senior-high-school/${grade}/physics`,
    },
    {
      icon: FlaskConicalIcon,
      label: "chemistry",
      href: `/subject/senior-high-school/${grade}/chemistry`,
    },
    {
      icon: PawPrintIcon,
      label: "biology",
      href: `/subject/senior-high-school/${grade}/biology`,
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
