import {
  BoardMathIcon,
  BookOpenTextIcon,
  BorobudurIcon,
  Brain02Icon,
  Building02Icon,
  Building04Icon,
  Building05Icon,
  Building06Icon,
  Calendar01Icon,
  Calendar02Icon,
  Calendar03Icon,
  CalendarCheck01Icon,
  CalendarDate1Icon,
  CalendarFavorite01Icon,
  CalendarFoldIcon,
  CalendarsIcon,
  Castle02Icon,
  Knowledge01Icon,
  LandmarkIcon,
  LibraryBigIcon,
  MonasIcon,
  Mortarboard02Icon,
  PuzzleIcon,
  Quiz04Icon,
  RankingIcon,
  SquareRootSquareIcon,
  TextFontIcon,
  TranslateIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { TryoutTrackKindSchema } from "@nakafa/aksara-contracts/tryout/spec";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { type Array as Arr, Match } from "effect";

/** The exams that the catalog knows, each with an icon of its own. */
export const TRYOUT_EXAM_ICONS = {
  snbt: RankingIcon,
  tka: Quiz04Icon,
} satisfies Record<string, IconSvgElement>;

/**
 * The exam subjects and subtests that are not curriculum materials, each with
 * an icon of its own. A subject or a section keeps its icon whether a track or
 * a row of a set shows it.
 */
export const TRYOUT_SUBJECT_ICONS = {
  "compulsory-mathematics": BoardMathIcon,
  "english-language": TranslateIcon,
  "general-knowledge-and-understanding": Knowledge01Icon,
  "general-reasoning": Brain02Icon,
  "indonesian-language": BorobudurIcon,
  "literacy-in-english": TextFontIcon,
  "literacy-in-indonesian": MonasIcon,
  "mathematical-reasoning": PuzzleIcon,
  "quantitative-knowledge": SquareRootSquareIcon,
  "reading-comprehension-and-writing": BookOpenTextIcon,
} satisfies Record<string, IconSvgElement>;

/** The calendars that the year tracks of one exam take apart, one each. */
export const TRYOUT_YEAR_ICONS: Arr.NonEmptyReadonlyArray<IconSvgElement> = [
  Calendar03Icon,
  Calendar01Icon,
  Calendar02Icon,
  CalendarDate1Icon,
  CalendarFoldIcon,
  CalendarsIcon,
  CalendarCheck01Icon,
  CalendarFavorite01Icon,
];

/** The icons that the institution tracks of one exam take apart, one each. */
export const TRYOUT_INSTITUTION_ICONS: Arr.NonEmptyReadonlyArray<IconSvgElement> =
  [
    Mortarboard02Icon,
    LandmarkIcon,
    Castle02Icon,
    Building04Icon,
    LibraryBigIcon,
    Building06Icon,
    Building05Icon,
    Building02Icon,
  ];

function isExamKey(key: string): key is keyof typeof TRYOUT_EXAM_ICONS {
  return Object.hasOwn(TRYOUT_EXAM_ICONS, key);
}

function isExamSubjectKey(
  key: string
): key is keyof typeof TRYOUT_SUBJECT_ICONS {
  return Object.hasOwn(TRYOUT_SUBJECT_ICONS, key);
}

/**
 * Resolves the icons that one exam may show: its own, or the spare icons for an
 * exam that the catalog does not know yet, so it never borrows the icon of
 * another exam.
 */
export function getTryoutExamIcons(
  examKey: string
): Arr.NonEmptyReadonlyArray<IconSvgElement> {
  return isExamKey(examKey) ? [TRYOUT_EXAM_ICONS[examKey]] : SPARE_ICONS;
}

/**
 * Resolves the icons that one subject or subtest may show, shared by the subject
 * tracks and the sections they hold: its own, or for a curriculum subject the
 * icon of that subject, or else the spare icons.
 */
export function getTryoutSubjectIcons(
  key: string
): Arr.NonEmptyReadonlyArray<IconSvgElement> {
  return isExamSubjectKey(key)
    ? [TRYOUT_SUBJECT_ICONS[key]]
    : getMaterialIcons(key);
}

/**
 * Resolves the icons that one track may show: the calendars of a year track,
 * the buildings of an institution track, and the icons of the subject of a
 * subject track. Tracks of one kind take them apart.
 */
export function getTryoutTrackIcons(
  trackKind: typeof TryoutTrackKindSchema.Type,
  trackKey: string
): Arr.NonEmptyReadonlyArray<IconSvgElement> {
  return Match.value(trackKind).pipe(
    Match.when("year", () => TRYOUT_YEAR_ICONS),
    Match.when("institution", () => TRYOUT_INSTITUTION_ICONS),
    Match.when("subject", () => getTryoutSubjectIcons(trackKey)),
    Match.exhaustive
  );
}
