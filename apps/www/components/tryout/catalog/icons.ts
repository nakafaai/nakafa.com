import {
  AbsoluteIcon,
  BookEditIcon,
  Brain02Icon,
  Calendar03Icon,
  Certificate02Icon,
  ChatQuestionIcon,
  File01Icon,
  LanguageSkillIcon,
  Mortarboard02Icon,
  PuzzleIcon,
  RankingIcon,
  SchoolReportCardIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { TryoutTrackKindSchema } from "@nakafa/aksara-contracts/tryout/spec";
import { getMaterialIcon } from "@repo/contents/curriculum/material";
import { Match } from "effect";

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
  return Match.value(examKey).pipe(
    Match.when("snbt", () => RankingIcon),
    Match.when("tka", () => SchoolReportCardIcon),
    Match.orElse(() => Certificate02Icon)
  );
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

/** Resolves one track identity to its year, institution, or subject icon. */
export function getTryoutTrackIcon(
  trackKind: typeof TryoutTrackKindSchema.Type,
  trackKey: string
): IconSvgElement {
  return Match.value(trackKind).pipe(
    Match.when("year", () => Calendar03Icon),
    Match.when("institution", () => Mortarboard02Icon),
    Match.when("subject", () => getTryoutSubjectIcon(trackKey)),
    Match.exhaustive
  );
}
