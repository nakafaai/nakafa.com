import {
  Certificate02Icon,
  CheckListIcon,
  ClipboardListIcon,
  FileChartColumnIcon,
  RankingIcon,
  SchoolReportCardIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

/** Resolves one try-out exam identity to its stable card icon. */
export function getTryoutExamIcon(examKey: string): IconSvgElement {
  switch (examKey) {
    case "snbt":
      return RankingIcon;
    case "tka":
      return SchoolReportCardIcon;
    default:
      return Certificate02Icon;
  }
}

/** Resolves one try-out set identity to its stable list icon. */
export function getTryoutSetIcon(setKey: string): IconSvgElement {
  switch (setKey) {
    case "set-1":
      return ClipboardListIcon;
    case "set-2":
      return FileChartColumnIcon;
    default:
      return CheckListIcon;
  }
}
