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
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";

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

const curriculumIconMarkVariants = cva("", {
  variants: {
    shape: {
      dot: "size-4 rounded-lg",
      full: "h-1 w-full rounded-full",
      medium: "h-1 w-2/3 rounded-full",
      short: "h-1 w-6 rounded-full",
    },
    tone: {
      amber: "bg-amber-500/20 dark:bg-amber-400/20",
      cyan: "bg-cyan-500/20 dark:bg-cyan-400/20",
      emerald: "bg-emerald-500/20 dark:bg-emerald-400/20",
      fuchsia: "bg-fuchsia-500/20 dark:bg-fuchsia-400/20",
      indigo: "bg-indigo-500/20 dark:bg-indigo-400/20",
      sky: "bg-sky-500/20 dark:bg-sky-400/20",
      violet: "bg-violet-500/20 dark:bg-violet-400/20",
    },
  },
});

const curriculumIconBadgeVariants = cva(
  "absolute flex items-center justify-center rounded-full border-2 border-card text-white shadow-xs transition-all ease-out group-hover:scale-110",
  {
    variants: {
      size: {
        large:
          "-bottom-2 -left-2 size-9 group-hover:-translate-x-1 group-hover:translate-y-1",
        small:
          "top-2 -right-2 size-6 group-hover:translate-x-1 group-hover:-translate-y-1",
      },
      tone: {
        amber: "bg-amber-500 dark:bg-amber-600",
        cyan: "bg-cyan-500 dark:bg-cyan-600",
        emerald: "bg-emerald-500 dark:bg-emerald-600",
        fuchsia: "bg-fuchsia-500 dark:bg-fuchsia-600",
        indigo: "bg-indigo-500 dark:bg-indigo-600",
        sky: "bg-sky-500 dark:bg-sky-600",
        violet: "bg-violet-500 dark:bg-violet-600",
      },
    },
  }
);

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
  framework: [StructureIcon, BoardMathIcon],
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
  qualification: [GraduationCapIcon, CertificateIcon],
  school: [LibraryIcon, BookOpenCheckIcon],
  science: [PhysicsIcon, TestTubeIcon],
  standards: [BoardMathIcon, StructureIcon],
  state: [GlobalEducationIcon, StructureIcon],
};

const navigationIconTones: {
  readonly [Key in ProgramNavigationIconKey]: CurriculumIconTone;
} = {
  advanced: "indigo",
  assessment: "cyan",
  certificate: "emerald",
  course: "sky",
  diploma: "fuchsia",
  "early-years": "sky",
  framework: "violet",
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
  qualification: "violet",
  school: "sky",
  science: "amber",
  standards: "violet",
  state: "cyan",
};

/** Renders root cards with the historical subject-page mini-card illustration. */
/* istanbul ignore next -- Browser proof covers the visual shell; icons.test.ts audits the production identity resolver. */
export function CurriculumRouteCardIcon({
  route,
}: {
  readonly route: PublicCurriculumRoute;
}) {
  const {
    iconPair: [PrimaryIcon, SecondaryIcon],
    tone,
  } = readCurriculumRouteVisualIdentity(route);

  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-col gap-1.5 rounded-md border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="flex items-center justify-between">
          <div className={curriculumIconMarkVariants({ shape: "dot", tone })} />
          <div
            className={curriculumIconMarkVariants({ shape: "short", tone })}
          />
        </div>
        <div className={curriculumIconMarkVariants({ shape: "full", tone })} />
        <div
          className={curriculumIconMarkVariants({ shape: "medium", tone })}
        />

        <div className={curriculumIconBadgeVariants({ size: "small", tone })}>
          <HugeIcons className="size-3.5" icon={SecondaryIcon} />
        </div>

        <div className={curriculumIconBadgeVariants({ size: "large", tone })}>
          <HugeIcons className="size-4.5" icon={PrimaryIcon} />
        </div>
      </div>
    </div>
  );
}

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
  iconKey: PublicCurriculumRoute["displayGroupIconKey"]
): IconSvgElement {
  if (iconKey) {
    const [primaryIcon] = navigationIconPairs[iconKey];

    return primaryIcon;
  }

  /* istanbul ignore next -- Non-card internal rows may omit group icon metadata; visible chooser groups are audited in icons.test.ts. */
  return navigationIconPairs.school[0];
}

/** Maps schema-owned route identity to non-redundant Hugeicons icon pairs. */
function readCurriculumRouteIconPair(
  route: PublicCurriculumRoute
): CurriculumIconPair {
  if (route.materialDomain) {
    return materialIconPairs[route.materialDomain];
  }

  /* istanbul ignore else -- Non-card internal rows may omit icon metadata; visible chooser rows are audited in icons.test.ts. */
  if (route.iconKey) {
    return navigationIconPairs[route.iconKey];
  }

  /* istanbul ignore next -- Non-card internal rows may omit icon metadata; visible chooser rows are audited in icons.test.ts. */
  return navigationIconPairs.school;
}

/** Chooses the old subject-card accent tone from schema-owned route fields. */
function readCurriculumIconTone(
  route: PublicCurriculumRoute
): CurriculumIconTone {
  if (route.materialDomain) {
    return materialIconTones[route.materialDomain];
  }

  /* istanbul ignore else -- Non-card internal rows may omit icon metadata; visible chooser rows are audited in icons.test.ts. */
  if (route.iconKey) {
    return navigationIconTones[route.iconKey];
  }

  /* istanbul ignore next -- Non-card internal rows may omit icon metadata; visible chooser rows are audited in icons.test.ts. */
  return navigationIconTones.school;
}
