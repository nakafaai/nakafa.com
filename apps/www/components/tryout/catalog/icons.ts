import {
  AbsoluteIcon,
  BookEditIcon,
  Brain02Icon,
  Calendar03Icon,
  Certificate02Icon,
  ChatQuestionIcon,
  File01Icon,
  LanguageSkillIcon,
  PuzzleIcon,
  RankingIcon,
  SchoolReportCardIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { getMaterialIcon } from "@repo/contents/curriculum/material";

/** Exam subjects and subtests that are not curriculum materials. */
const examSubjectIcons = {
  "english-language": LanguageSkillIcon,
  "general-knowledge-and-understanding": BookEditIcon,
  "general-reasoning": Brain02Icon,
  "indonesian-language": ChatQuestionIcon,
  "literacy-in-english": LanguageSkillIcon,
  "literacy-in-indonesian": ChatQuestionIcon,
  "mathematical-reasoning": PuzzleIcon,
  "quantitative-knowledge": AbsoluteIcon,
  "reading-comprehension-and-writing": File01Icon,
} satisfies Record<string, IconSvgElement>;

type ExamSubjectKey = keyof typeof examSubjectIcons;

function isExamSubjectKey(key: string): key is ExamSubjectKey {
  return Object.hasOwn(examSubjectIcons, key);
}

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

/**
 * Resolves one subject or subtest identity, shared by subject tracks and the
 * sections they hold, to its icon. Curriculum subjects reuse material icons.
 */
export function getTryoutSubjectIcon(key: string): IconSvgElement {
  if (isExamSubjectKey(key)) {
    return examSubjectIcons[key];
  }
  return getMaterialIcon(
    key === "compulsory-mathematics" ? "mathematics" : key
  );
}

/** Resolves one track identity to its year or subject icon. */
export function getTryoutTrackIcon(
  trackKind: "subject" | "year",
  trackKey: string
): IconSvgElement {
  if (trackKind === "year") {
    return Calendar03Icon;
  }
  return getTryoutSubjectIcon(trackKey);
}
