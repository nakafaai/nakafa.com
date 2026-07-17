import {
  Certificate02Icon,
  RankingIcon,
  SchoolReportCardIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";

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

/** Resolves one subject track identity to its stable material icon. */
export function getTryoutTrackIcon(trackKey: string): IconSvgElement {
  return getMaterialIcon(trackKey);
}
