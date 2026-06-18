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

type CurriculumIconTone =
  | "amber"
  | "cyan"
  | "emerald"
  | "fuchsia"
  | "indigo"
  | "sky"
  | "violet";
type CurriculumIconPair = readonly [IconSvgElement, IconSvgElement];
type CurriculumRouteVisualIdentity = Readonly<{
  iconPair: CurriculumIconPair;
  tone: CurriculumIconTone;
}>;
type CurriculumVisualSource =
  | Readonly<{ kind: "material"; key: Material }>
  | Readonly<{ kind: "navigation"; key: ProgramNavigationIconKey }>;

const materialIconPairs: { readonly [Key in Material]: CurriculumIconPair } = {
  "ai-ds": [Brain02Icon, StructureIcon],
  biology: [DnaIcon, MicroscopeIcon],
  chemistry: [TestTubeIcon, Atom02Icon],
  "computer-science": [Atom02Icon, Brain02Icon],
  economy: [AssignmentsIcon, CertificateIcon],
  "game-engineering": [StructureIcon, Brain02Icon],
  geography: [GlobalEducationIcon, StructureIcon],
  geospatial: [GlobalEducationIcon, BoardMathIcon],
  history: [LibraryIcon, BookOpenCheckIcon],
  informatics: [Atom02Icon, Brain02Icon],
  "informatics-engineering": [Atom02Icon, StructureIcon],
  "international-relations": [GlobalEducationIcon, UniversityIcon],
  mathematics: [MathIcon, BoardMathIcon],
  physics: [PhysicsIcon, Atom02Icon],
  "political-science": [UniversityIcon, CertificateIcon],
  sociology: [Knowledge01Icon, LibraryIcon],
  "technology-electro-medical": [TestTubeIcon, MicroscopeIcon],
};

const materialIconTones: { readonly [Key in Material]: CurriculumIconTone } = {
  "ai-ds": "sky",
  biology: "emerald",
  chemistry: "violet",
  "computer-science": "sky",
  economy: "cyan",
  "game-engineering": "amber",
  geography: "cyan",
  geospatial: "fuchsia",
  history: "amber",
  informatics: "sky",
  "informatics-engineering": "violet",
  "international-relations": "indigo",
  mathematics: "indigo",
  physics: "amber",
  "political-science": "emerald",
  sociology: "fuchsia",
  "technology-electro-medical": "emerald",
};

const navigationIconPairs: {
  readonly [Key in ProgramNavigationIconKey]: CurriculumIconPair;
} = {
  advanced: [GraduationCapIcon, UniversityIcon],
  assessment: [AssignmentsIcon, CertificateIcon],
  certificate: [CertificateIcon, BookOpenCheckIcon],
  course: [BookOpenCheckIcon, Books02Icon],
  diploma: [DiplomaIcon, GraduationCapIcon],
  "early-years": [Backpack01Icon, BookOpen02Icon],
  "global-education": [GlobalEducationIcon, SchoolIcon],
  "grade-1": [Backpack01Icon, BookOpen02Icon],
  "grade-2": [BookOpen02Icon, Books02Icon],
  "grade-3": [Books02Icon, Knowledge01Icon],
  "grade-4": [BoardMathIcon, MathIcon],
  "grade-5": [Brain02Icon, Knowledge01Icon],
  "grade-6": [Knowledge01Icon, CertificateIcon],
  "grade-7": [SchoolBellIcon, Books02Icon],
  "grade-8": [AssignmentsIcon, BoardMathIcon],
  "grade-9": [CertificateIcon, AssignmentsIcon],
  "grade-10": [Atom02Icon, Brain02Icon],
  "grade-11": [MicroscopeIcon, DnaIcon],
  "grade-12": [DiplomaIcon, SchoolIcon],
  "high-school": [UniversityIcon, GraduationCapIcon],
  mathematics: [MathIcon, BoardMathIcon],
  "middle-school": [SchoolBellIcon, Books02Icon],
  "primary-school": [SchoolIcon, Backpack01Icon],
  school: [LibraryIcon, BookOpenCheckIcon],
  science: [PhysicsIcon, TestTubeIcon],
  standards: [BoardMathIcon, StructureIcon],
  state: [GlobalEducationIcon, StructureIcon],
};

const navigationIconTones: {
  readonly [Key in ProgramNavigationIconKey]: CurriculumIconTone;
} = {
  advanced: "fuchsia",
  assessment: "cyan",
  certificate: "emerald",
  course: "sky",
  diploma: "fuchsia",
  "early-years": "sky",
  "global-education": "cyan",
  "grade-1": "sky",
  "grade-2": "indigo",
  "grade-3": "emerald",
  "grade-4": "amber",
  "grade-5": "fuchsia",
  "grade-6": "cyan",
  "grade-7": "sky",
  "grade-8": "violet",
  "grade-9": "emerald",
  "grade-10": "amber",
  "grade-11": "fuchsia",
  "grade-12": "indigo",
  "high-school": "amber",
  mathematics: "indigo",
  "middle-school": "violet",
  "primary-school": "emerald",
  school: "sky",
  science: "amber",
  standards: "violet",
  state: "cyan",
};

/** Resolves source-owned route identity to verified Hugeicons card icons. */
export function readCurriculumRouteIcon(route: PublicCurriculumRoute) {
  const {
    iconPair: [primaryIcon],
  } = readCurriculumRouteVisualIdentity(route);

  return primaryIcon;
}

/**
 * Resolves the production card icon pair and accent tone for one curriculum row.
 *
 * Curriculum chooser audits use this same identity so sibling uniqueness is
 * proven against the visual contract rendered by `CurriculumRouteCardIcon`.
 */
export function readCurriculumRouteVisualIdentity(
  route: PublicCurriculumRoute
): CurriculumRouteVisualIdentity {
  return {
    iconPair: readCurriculumRouteIconPair(route),
    tone: readCurriculumIconTone(route),
  };
}

/** Selects a grouped-root section icon from source-owned group metadata. */
export function readCurriculumGroupIcon(
  iconKey: ProgramNavigationIconKey
): IconSvgElement {
  const [primaryIcon] = navigationIconPairs[iconKey];

  return primaryIcon;
}

/** Maps schema-owned route identity to non-redundant Hugeicons icon pairs. */
function readCurriculumRouteIconPair(
  route: PublicCurriculumRoute
): CurriculumIconPair {
  const source = readCurriculumVisualSource(route);

  if (source.kind === "navigation") {
    return navigationIconPairs[source.key];
  }

  return materialIconPairs[source.key];
}

/** Chooses the old subject-card accent tone from schema-owned route fields. */
function readCurriculumIconTone(
  route: PublicCurriculumRoute
): CurriculumIconTone {
  const source = readCurriculumVisualSource(route);

  if (source.kind === "navigation") {
    return navigationIconTones[source.key];
  }

  return materialIconTones[source.key];
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
