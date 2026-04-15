import {
  ArchiveIcon,
  NoteEditIcon,
  Rocket01Icon,
  TimeScheduleIcon,
} from "@hugeicons/core-free-icons";

export const assessmentStatusList = [
  {
    icon: NoteEditIcon,
    labelKey: "status-draft",
    value: "draft",
  },
  {
    icon: Rocket01Icon,
    labelKey: "status-published",
    value: "published",
  },
  {
    icon: TimeScheduleIcon,
    labelKey: "status-schedule",
    value: "scheduled",
  },
  {
    icon: ArchiveIcon,
    labelKey: "status-archived",
    value: "archived",
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
