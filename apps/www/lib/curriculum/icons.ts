import {
  AbacusIcon,
  Backpack01Icon,
  Backpack02Icon,
  Book01Icon,
  BookBookmark01Icon,
  CalendarMortarboardIcon,
  CourseIcon,
  DiplomaIcon,
  Flag01Icon,
  KidIcon,
  Medal01Icon,
  MoleculesIcon,
  Mortarboard01Icon,
  Notebook01Icon,
  OnlineLearning01Icon,
  PencilRulerIcon,
  Presentation01Icon,
  Quiz03Icon,
  School01Icon,
  SchoolBell01Icon,
  SchoolIcon,
  SchoolReportCardIcon,
  SchoolTieIcon,
  StudentCardIcon,
  StudentIcon,
  StudentsIcon,
  Target01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { ProgramNavigationIconKey } from "@nakafa/aksara-contracts/program/spec";

/**
 * The icon of each source-owned navigation identity: a stage, a class, a
 * course. It is the only owner of the icon of a stage, so the curriculum cards,
 * the sidebar, and the search palette draw the same icon for the same stage,
 * and none of them is shared with any other key of the product.
 */
export const CURRICULUM_NAVIGATION_ICONS: {
  readonly [Key in ProgramNavigationIconKey]: IconSvgElement;
} = {
  advanced: Mortarboard01Icon,
  assessment: Quiz03Icon,
  certificate: CalendarMortarboardIcon,
  course: CourseIcon,
  diploma: DiplomaIcon,
  "early-years": KidIcon,
  "global-education": OnlineLearning01Icon,
  "grade-1": Backpack01Icon,
  "grade-2": PencilRulerIcon,
  "grade-3": Book01Icon,
  "grade-4": Notebook01Icon,
  "grade-5": BookBookmark01Icon,
  "grade-6": SchoolReportCardIcon,
  "grade-7": StudentIcon,
  "grade-8": StudentsIcon,
  "grade-9": StudentCardIcon,
  "grade-10": SchoolTieIcon,
  "grade-11": Presentation01Icon,
  "grade-12": Medal01Icon,
  "high-school": School01Icon,
  mathematics: AbacusIcon,
  "middle-school": SchoolBell01Icon,
  "primary-school": Backpack02Icon,
  school: SchoolIcon,
  science: MoleculesIcon,
  standards: Target01Icon,
  state: Flag01Icon,
};
