import {
  BookEditIcon,
  Notebook01Icon,
  PresentationBarChart01Icon,
  SchoolReportCardIcon,
  Task01Icon,
} from "@hugeicons/core-free-icons";

export const assessmentModeList = [
  {
    icon: Notebook01Icon,
    labelKey: "assessment-mode-practice",
    value: "practice",
  },
  {
    icon: Task01Icon,
    labelKey: "assessment-mode-assignment",
    value: "assignment",
  },
  {
    icon: BookEditIcon,
    labelKey: "assessment-mode-quiz",
    value: "quiz",
  },
  {
    icon: SchoolReportCardIcon,
    labelKey: "assessment-mode-exam",
    value: "exam",
  },
  {
    icon: PresentationBarChart01Icon,
    labelKey: "assessment-mode-tryout",
    value: "tryout",
  },
] as const;

/** Return the configured assessment mode metadata for one mode value. */
export function getAssessmentMode(
  value: (typeof assessmentModeList)[number]["value"]
) {
  return (
    assessmentModeList.find((mode) => mode.value === value) ??
    assessmentModeList[0]
  );
}
