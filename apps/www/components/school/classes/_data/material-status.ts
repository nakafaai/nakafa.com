import {
  ArchiveIcon,
  NoteEditIcon,
  Rocket01Icon,
  TimeScheduleIcon,
} from "@hugeicons/core-free-icons";

export const materialStatusList = [
  {
    value: "published",
    labelKey: "status-publish-now",
    icon: Rocket01Icon,
  },
  {
    value: "draft",
    labelKey: "status-draft",
    icon: NoteEditIcon,
  },
  {
    value: "scheduled",
    labelKey: "status-schedule",
    icon: TimeScheduleIcon,
  },
  {
    value: "archived",
    labelKey: "status-archived",
    icon: ArchiveIcon,
  },
] as const;

export type MaterialStatusValue = (typeof materialStatusList)[number]["value"];

/**
 * Gets the material status by value.
 * @param value - The value of the material status.
 * @returns The material status.
 */
export function getMaterialStatus(value: MaterialStatusValue) {
  return (
    // Default to published if no status is found
    materialStatusList.find((s) => s.value === value) ?? materialStatusList[0]
  );
}
