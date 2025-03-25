import {
  ChartPieIcon,
  CodeIcon,
  DraftingCompassIcon,
  EarthIcon,
  FlaskConicalIcon,
  HourglassIcon,
  MapIcon,
  PawPrintIcon,
  PiIcon,
} from "lucide-react";

const BASE_PATH = "/subject/senior-high-school";

function getSubjects(grade: number) {
  return [
    {
      icon: PiIcon,
      label: "mathematics",
      href: `${BASE_PATH}/${grade}/mathematics`,
    },
    {
      icon: DraftingCompassIcon,
      label: "physics",
      href: `${BASE_PATH}/${grade}/physics`,
    },
    {
      icon: FlaskConicalIcon,
      label: "chemistry",
      href: `${BASE_PATH}/${grade}/chemistry`,
    },
    {
      icon: PawPrintIcon,
      label: "biology",
      href: `${BASE_PATH}/${grade}/biology`,
    },
    {
      icon: EarthIcon,
      label: "geography",
      href: `${BASE_PATH}/${grade}/geography`,
    },
    {
      icon: ChartPieIcon,
      label: "economy",
      href: `${BASE_PATH}/${grade}/economy`,
    },
    {
      icon: HourglassIcon,
      label: "history",
      href: `${BASE_PATH}/${grade}/history`,
    },
    {
      icon: CodeIcon,
      label: "informatics",
      href: `${BASE_PATH}/${grade}/informatics`,
    },
    {
      icon: MapIcon,
      label: "geospatial",
      href: `${BASE_PATH}/${grade}/geospatial`,
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
