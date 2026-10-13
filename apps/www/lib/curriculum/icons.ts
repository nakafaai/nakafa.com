import {
  AbacusIcon,
  AlarmClockIcon,
  Backpack01Icon,
  Basketball01Icon,
  Book01Icon,
  DiplomaIcon,
  Flag01Icon,
  KidIcon,
  Medal01Icon,
  MoleculesIcon,
  MusicNote01Icon,
  OnlineLearning01Icon,
  PaletteIcon,
  PencilRulerIcon,
  Presentation01Icon,
  Rocket01Icon,
  School01Icon,
  SchoolBell01Icon,
  SchoolBusIcon,
  SchoolIcon,
  SchoolReportCardIcon,
  SchoolTieIcon,
  SignatureIcon,
  Stairs01Icon,
  StudentCardIcon,
  StudentIcon,
  Target01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { ProgramNavigationIconKey } from "@nakafa/aksara-contracts/program/spec";

/**
 * The icon of each source-owned navigation identity: a stage, a class, a
 * course. It is the only owner of the icon of a stage, so the curriculum cards,
 * the sidebar, and the search palette draw the same icon for the same stage,
 * and none of them is shared with any other key of the product, as the test of
 * `components/tryout/catalog/icons.test.ts` keeps. The twelve
 * grades are twelve different objects at 40px, since the classes of one stage
 * share one grid: a backpack, a pencil and a ruler, a book, a palette, a
 * basketball, a report card, a student, a note of music, a student card, a tie,
 * a presentation, and a medal.
 */
export const CURRICULUM_NAVIGATION_ICONS: {
  readonly [Key in ProgramNavigationIconKey]: IconSvgElement;
} = {
  advanced: Rocket01Icon,
  assessment: AlarmClockIcon,
  certificate: SignatureIcon,
  course: Stairs01Icon,
  diploma: DiplomaIcon,
  "early-years": KidIcon,
  "global-education": OnlineLearning01Icon,
  "grade-1": Backpack01Icon,
  "grade-2": PencilRulerIcon,
  "grade-3": Book01Icon,
  "grade-4": PaletteIcon,
  "grade-5": Basketball01Icon,
  "grade-6": SchoolReportCardIcon,
  "grade-7": StudentIcon,
  "grade-8": MusicNote01Icon,
  "grade-9": StudentCardIcon,
  "grade-10": SchoolTieIcon,
  "grade-11": Presentation01Icon,
  "grade-12": Medal01Icon,
  "high-school": School01Icon,
  mathematics: AbacusIcon,
  "middle-school": SchoolBell01Icon,
  "primary-school": SchoolBusIcon,
  school: SchoolIcon,
  science: MoleculesIcon,
  standards: Target01Icon,
  state: Flag01Icon,
};
