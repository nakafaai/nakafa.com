import {
  AssignmentsIcon,
  Atom02Icon,
  Backpack01Icon,
  BoardMathIcon,
  BookOpen02Icon,
  BookOpenCheckIcon,
  Books02Icon,
  Brain02Icon,
  CertificateIcon,
  DiplomaIcon,
  DnaIcon,
  GlobalEducationIcon,
  GraduationCapIcon,
  Knowledge01Icon,
  LibraryIcon,
  MathIcon,
  MicroscopeIcon,
  PhysicsIcon,
  SchoolBellIcon,
  SchoolIcon,
  StructureIcon,
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
  advanced: GraduationCapIcon,
  assessment: AssignmentsIcon,
  certificate: CertificateIcon,
  course: BookOpenCheckIcon,
  diploma: DiplomaIcon,
  "early-years": Backpack01Icon,
  "global-education": GlobalEducationIcon,
  "grade-1": Backpack01Icon,
  "grade-2": BookOpen02Icon,
  "grade-3": Books02Icon,
  "grade-4": BoardMathIcon,
  "grade-5": Brain02Icon,
  "grade-6": Knowledge01Icon,
  "grade-7": SchoolBellIcon,
  "grade-8": AssignmentsIcon,
  "grade-9": CertificateIcon,
  "grade-10": Atom02Icon,
  "grade-11": MicroscopeIcon,
  "grade-12": DiplomaIcon,
  "high-school": UniversityIcon,
  mathematics: MathIcon,
  "middle-school": SchoolBellIcon,
  "primary-school": SchoolIcon,
  school: LibraryIcon,
  science: PhysicsIcon,
  standards: StructureIcon,
  state: GlobalEducationIcon,
};

/** Resolves source-owned route identity to a verified Hugeicons card icon. */
export function readCurriculumRouteIcon(route: PublicCurriculumRoute) {
  const source = readCurriculumVisualSource(route);

  if (source.kind === "navigation") {
    return navigationIcons[source.key];
  }

  return materialIcons[source.key];
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
