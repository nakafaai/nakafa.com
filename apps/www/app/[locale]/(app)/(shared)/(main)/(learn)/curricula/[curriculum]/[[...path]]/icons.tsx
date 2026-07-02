import {
  AbacusIcon,
  AssignmentsIcon,
  Atom02Icon,
  Backpack01Icon,
  Backpack02Icon,
  BoardMathIcon,
  Book01Icon,
  BookBookmark01Icon,
  Brain02Icon,
  CalendarMortarboardIcon,
  CertificateIcon,
  CourseIcon,
  DiplomaIcon,
  DnaIcon,
  Flag01Icon,
  GlobalEducationIcon,
  KidIcon,
  Knowledge01Icon,
  LibraryIcon,
  MathIcon,
  Medal01Icon,
  MicroscopeIcon,
  MoleculesIcon,
  Mortarboard01Icon,
  Notebook01Icon,
  OnlineLearning01Icon,
  PencilRulerIcon,
  PhysicsIcon,
  Presentation01Icon,
  Quiz03Icon,
  School01Icon,
  SchoolBell01Icon,
  SchoolIcon,
  SchoolReportCardIcon,
  SchoolTieIcon,
  StructureIcon,
  StudentCardIcon,
  StudentIcon,
  StudentsIcon,
  Target01Icon,
  TestTubeIcon,
  UniversityIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { ProgramNavigationIconKey } from "@repo/contents/_types/program/schema";
import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
import type { Material } from "@repo/contents/_types/taxonomy";

type CurriculumVisualSource =
  | Readonly<{ kind: "material"; key: Material }>
  | Readonly<{ kind: "navigation"; key: ProgramNavigationIconKey }>;

const materialIcons: { readonly [Key in Material]: IconSvgElement } = {
  "ai-ds": Brain02Icon,
  biology: DnaIcon,
  chemistry: TestTubeIcon,
  "computer-science": Atom02Icon,
  economy: AssignmentsIcon,
  "game-engineering": StructureIcon,
  geography: GlobalEducationIcon,
  geospatial: BoardMathIcon,
  history: LibraryIcon,
  informatics: Brain02Icon,
  "informatics-engineering": UniversityIcon,
  "international-relations": GlobalEducationIcon,
  mathematics: MathIcon,
  physics: PhysicsIcon,
  "political-science": CertificateIcon,
  sociology: Knowledge01Icon,
  "technology-electro-medical": MicroscopeIcon,
};

const navigationIcons: {
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

/** Resolves a source-owned material identity to its Hugeicons card icon. */
export function readCurriculumMaterialIcon(material: Material) {
  return materialIcons[material];
}

/** Resolves a source-owned navigation identity to its Hugeicons card icon. */
export function readCurriculumNavigationIcon(key: ProgramNavigationIconKey) {
  return navigationIcons[key];
}

/** Resolves source-owned route identity to a verified Hugeicons card icon. */
export function readCurriculumRouteIcon(route: PublicCurriculumRoute) {
  const source = readCurriculumVisualSource(route);

  if (source.kind === "navigation") {
    return readCurriculumNavigationIcon(source.key);
  }

  return readCurriculumMaterialIcon(source.key);
}

/**
 * Selects the source-owned identity that drives curriculum card visuals.
 *
 * Generic subject icon keys stay domain-driven so science siblings keep
 * biology, chemistry, and physics identities from `materialDomain`; specific
 * course/stage keys keep their authored navigation identity.
 */
function readCurriculumVisualSource(
  route: PublicCurriculumRoute
): CurriculumVisualSource {
  if (!route.materialDomain) {
    return { kind: "navigation", key: route.iconKey };
  }

  if (
    route.iconKey &&
    route.iconKey !== "mathematics" &&
    route.iconKey !== "science"
  ) {
    return { kind: "navigation", key: route.iconKey };
  }

  return { kind: "material", key: route.materialDomain };
}
