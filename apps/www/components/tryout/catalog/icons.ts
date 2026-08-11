import {
  Calendar03Icon,
  Certificate02Icon,
  RankingIcon,
  SchoolReportCardIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";

/** Resolves one try-out exam identity to its stable selector icon. */
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

/** Resolves one track identity to its year or subject icon. */
export function getTryoutTrackIcon(
  trackKind: "subject" | "year",
  trackKey: string
): IconSvgElement {
  if (trackKind === "year") {
    return Calendar03Icon;
  }

  return getMaterialIcon(trackKey);
}
