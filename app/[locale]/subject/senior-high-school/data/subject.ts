import { DraftingCompassIcon, PiIcon } from "lucide-react";

export const grade10Subjects = [
  {
    icon: PiIcon,
    label: "mathematics",
    href: "/subject/senior-high-school/10/mathematics",
  },
  {
    icon: DraftingCompassIcon,
    label: "physics",
    href: "/subject/senior-high-school/10/physics",
  },
] as const;

export const grade11Subjects = [
  {
    icon: PiIcon,
    label: "mathematics",
    href: "/subject/senior-high-school/11/mathematics",
  },
  {
    icon: DraftingCompassIcon,
    label: "physics",
    href: "/subject/senior-high-school/11/physics",
  },
] as const;

export const grade12Subjects = [
  {
    icon: PiIcon,
    label: "mathematics",
    href: "/subject/senior-high-school/12/mathematics",
  },
  {
    icon: DraftingCompassIcon,
    label: "physics",
    href: "/subject/senior-high-school/12/physics",
  },
] as const;

export const seniorHighSchoolSubjects = {
  grade10: grade10Subjects,
  grade11: grade11Subjects,
  grade12: grade12Subjects,
} as const;
