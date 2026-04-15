import {
  Calendar03Icon,
  Notebook01Icon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";

export const assessmentStatusList = [
  {
    icon: Notebook01Icon,
    labelKey: "status-draft",
    value: "draft",
  },
  {
    icon: Rocket01Icon,
    labelKey: "status-publish-now",
    value: "published",
  },
  {
    icon: Calendar03Icon,
    labelKey: "status-schedule",
    value: "scheduled",
  },
] as const;

/** Return the configured assessment status metadata for one status value. */
export function getAssessmentStatus(
  value: (typeof assessmentStatusList)[number]["value"]
) {
  return (
    assessmentStatusList.find((status) => status.value === value) ??
    assessmentStatusList[0]
  );
}
