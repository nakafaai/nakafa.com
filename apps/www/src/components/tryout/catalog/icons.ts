import {
  Backpack02Icon,
  BoardMathIcon,
  Book04Icon,
  BookOpenTextIcon,
  BookSearchIcon,
  Brain02Icon,
  Building06Icon,
  Calendar01Icon,
  CalendarsIcon,
  DeskIcon,
  DigitalClockIcon,
  Factory01Icon,
  FileTextIcon,
  FireworksIcon,
  GraduationScrollIcon,
  Hospital01Icon,
  Knowledge01Icon,
  LandmarkIcon,
  LanguagesIcon,
  LibraryBigIcon,
  LighthouseIcon,
  Mortarboard02Icon,
  Notebook02Icon,
  PartyPopperIcon,
  PuzzleIcon,
  QuillWriteIcon,
  Quiz04Icon,
  RankingIcon,
  RulerIcon,
  SchoolBell02Icon,
  SquareRootSquareIcon,
  StopWatchIcon,
  StudentsIcon,
  SunMoonIcon,
  SunriseIcon,
  TeacherIcon,
  TheaterIcon,
  TimeZoneIcon,
  UniversityIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { GroupAxisSchema } from "@nakafa/aksara-contracts/assessment/catalog";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { Array as Arr, Match, Option, Record as Rec } from "effect";

/** The exams that the catalog knows, each with an icon of its own. */
export const TRYOUT_EXAM_ICONS: Readonly<Record<string, IconSvgElement>> = {
  snbt: RankingIcon,
  tka: Quiz04Icon,
};

/**
 * The exam subjects and subtests that are not curriculum materials, each with
 * an icon of its own. A subject or a section keeps its icon whether a track or
 * a row of a set shows it. The four language keys read as language: the two
 * language subjects as many languages and as writing, the two literacy
 * sections as reading a text, one in a book that is searched and one in a page
 * of text. The interface language switcher draws `TranslateIcon`, so no
 * subject takes it.
 */
export const TRYOUT_SUBJECT_ICONS: Readonly<Record<string, IconSvgElement>> = {
  "compulsory-mathematics": BoardMathIcon,
  "english-language": LanguagesIcon,
  "general-knowledge-and-understanding": Knowledge01Icon,
  "general-reasoning": Brain02Icon,
  "indonesian-language": QuillWriteIcon,
  "literacy-in-english": FileTextIcon,
  "literacy-in-indonesian": BookSearchIcon,
  "mathematical-reasoning": PuzzleIcon,
  "quantitative-knowledge": SquareRootSquareIcon,
  "reading-comprehension-and-writing": BookOpenTextIcon,
};

/**
 * The drawings that the year groups of one exam take apart, one each: a
 * calendar and a stack of calendars, a digital clock, a stopwatch, the sun and
 * the moon, a sunrise, a globe with a clock, fireworks, and a party popper.
 * Each is a different object at 40px: calendars that differ only by a mark
 * inside the frame, and clocks that differ only by their hands, read alike, so
 * no more of them are here.
 */
export const TRYOUT_YEAR_ICONS: Arr.NonEmptyReadonlyArray<IconSvgElement> = [
  Calendar01Icon,
  CalendarsIcon,
  DigitalClockIcon,
  StopWatchIcon,
  SunMoonIcon,
  SunriseIcon,
  TimeZoneIcon,
  FireworksIcon,
  PartyPopperIcon,
];

/**
 * The icons that the institution groups of one exam take apart, one each: a
 * mortarboard, a building with columns, a campus, a library, an office, a
 * factory, a hospital, a theatre, and a lighthouse. Buildings that differ only
 * by their windows or by a spire read alike at 40px, so each is a different
 * kind of place.
 */
export const TRYOUT_INSTITUTION_ICONS: Arr.NonEmptyReadonlyArray<IconSvgElement> =
  [
    Mortarboard02Icon,
    LandmarkIcon,
    UniversityIcon,
    LibraryBigIcon,
    Building06Icon,
    Factory01Icon,
    Hospital01Icon,
    TheaterIcon,
    LighthouseIcon,
  ];

/**
 * Resolves the icons that one exam may show: its own, or the spare icons for an
 * exam that the catalog does not know yet, so it never borrows the icon of
 * another exam.
 */
export function getTryoutExamIcons(
  examKey: string
): Arr.NonEmptyReadonlyArray<IconSvgElement> {
  return Option.match(Rec.get(TRYOUT_EXAM_ICONS, examKey), {
    onNone: () => SPARE_ICONS,
    onSome: Arr.of,
  });
}

/**
 * Resolves the icons that one subject or subtest may show, shared by the subject
 * tracks and the sections they hold: its own, or for a curriculum subject the
 * icon of that subject, or else the spare icons.
 */
export function getTryoutSubjectIcons(
  key: string
): Arr.NonEmptyReadonlyArray<IconSvgElement> {
  return Option.match(Rec.get(TRYOUT_SUBJECT_ICONS, key), {
    onNone: () => getMaterialIcons(key),
    onSome: Arr.of,
  });
}

/**
 * The icons that the grade groups of one exam take apart, one each: a desk, a
 * backpack, a school bell, a group of students, a teacher at a board, a ruler,
 * a notebook, a book, and a graduation scroll. Each is a different object at
 * 40px, and none is the icon of a curriculum stage or class.
 */
export const TRYOUT_GRADE_ICONS: Arr.NonEmptyReadonlyArray<IconSvgElement> = [
  DeskIcon,
  Backpack02Icon,
  SchoolBell02Icon,
  StudentsIcon,
  TeacherIcon,
  RulerIcon,
  Notebook02Icon,
  Book04Icon,
  GraduationScrollIcon,
];

/**
 * Resolves the icons that the groups of one exam take apart, by the axis the
 * exam divides by: the drawings of time of a year, the schools of a grade, and
 * the buildings of an institution.
 */
export function getTryoutGroupIcons(
  axis: typeof GroupAxisSchema.Type
): Arr.NonEmptyReadonlyArray<IconSvgElement> {
  return Match.value(axis).pipe(
    Match.when("year", () => TRYOUT_YEAR_ICONS),
    Match.when("grade", () => TRYOUT_GRADE_ICONS),
    Match.when("institution", () => TRYOUT_INSTITUTION_ICONS),
    Match.exhaustive
  );
}
