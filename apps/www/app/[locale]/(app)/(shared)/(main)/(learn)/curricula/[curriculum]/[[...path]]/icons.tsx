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
import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
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

/** Renders root cards with the historical subject-page mini-card illustration. */
export function CurriculumRouteCardIcon({
  route,
}: {
  readonly route: PublicCurriculumRoute;
}) {
  const [PrimaryIcon, SecondaryIcon] = readCurriculumRouteIconPair(route);
  const tone = readCurriculumIconTone(route);

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
  const [primaryIcon] = readCurriculumRouteIconPair(route);

  return primaryIcon;
}

/** Selects a grouped-root section icon from source-owned group metadata. */
export function readCurriculumGroupIcon(
  iconKey: PublicCurriculumRoute["displayGroupIconKey"]
): IconSvgElement {
  const [primaryIcon] = readNavigationIconPair(iconKey);

  return primaryIcon;
}

/** Maps schema-owned route identity to non-redundant Hugeicons icon pairs. */
function readCurriculumRouteIconPair(
  route: PublicCurriculumRoute
): CurriculumIconPair {
  if (route.materialDomain) {
    switch (route.materialDomain) {
      case "biology":
        return [DnaIcon, MicroscopeIcon];
      case "chemistry":
        return [TestTubeIcon, Atom02Icon];
      case "mathematics":
        return [MathIcon, BoardMathIcon];
      case "physics":
        return [PhysicsIcon, Atom02Icon];
      case "ai-ds":
        return [Brain02Icon, StructureIcon];
      case "informatics":
        return [Atom02Icon, Brain02Icon];
      default:
        return [LibraryIcon, Books02Icon];
    }
  }

  return readNavigationIconPair(route.iconKey);
}

/** Maps schema-owned navigation icon keys to paired Hugeicons identities. */
function readNavigationIconPair(
  iconKey: PublicCurriculumRoute["iconKey"]
): CurriculumIconPair {
  switch (iconKey) {
    case "advanced":
      return [GraduationCapIcon, UniversityIcon];
    case "assessment":
      return [AssignmentsIcon, CertificateIcon];
    case "certificate":
      return [CertificateIcon, BookOpenCheckIcon];
    case "course":
      return [BookOpenCheckIcon, Books02Icon];
    case "diploma":
      return [DiplomaIcon, GraduationCapIcon];
    case "early-years":
      return [Backpack01Icon, BookOpen02Icon];
    case "framework":
      return [StructureIcon, BoardMathIcon];
    case "global-education":
      return [GlobalEducationIcon, SchoolIcon];
    case "grade-1":
      return [Backpack01Icon, BookOpen02Icon];
    case "grade-2":
      return [BookOpen02Icon, Books02Icon];
    case "grade-3":
      return [Books02Icon, Knowledge01Icon];
    case "grade-4":
      return [BoardMathIcon, MathIcon];
    case "grade-5":
      return [Brain02Icon, Knowledge01Icon];
    case "grade-6":
      return [Knowledge01Icon, CertificateIcon];
    case "grade-7":
      return [SchoolBellIcon, Books02Icon];
    case "grade-8":
      return [AssignmentsIcon, BoardMathIcon];
    case "grade-9":
      return [CertificateIcon, AssignmentsIcon];
    case "grade-10":
      return [Atom02Icon, Brain02Icon];
    case "grade-11":
      return [MicroscopeIcon, DnaIcon];
    case "grade-12":
      return [DiplomaIcon, SchoolIcon];
    case "high-school":
      return [UniversityIcon, GraduationCapIcon];
    case "mathematics":
      return [MathIcon, BoardMathIcon];
    case "middle-school":
      return [SchoolBellIcon, Books02Icon];
    case "primary-school":
      return [SchoolIcon, Backpack01Icon];
    case "qualification":
      return [GraduationCapIcon, CertificateIcon];
    case "science":
      return [PhysicsIcon, TestTubeIcon];
    case "school":
      return [SchoolIcon, Books02Icon];
    case "state":
      return [GlobalEducationIcon, StructureIcon];
    case "standards":
      return [BoardMathIcon, StructureIcon];
    default:
      return [Books02Icon, BookOpen02Icon];
  }
}

/** Chooses the old subject-card accent tone from schema-owned route fields. */
function readCurriculumIconTone(
  route: PublicCurriculumRoute
): CurriculumIconTone {
  if (route.materialDomain) {
    switch (route.materialDomain) {
      case "biology":
        return "emerald";
      case "chemistry":
        return "violet";
      case "mathematics":
        return "indigo";
      case "physics":
        return "amber";
      default:
        return "sky";
    }
  }

  switch (route.iconKey) {
    case "advanced":
    case "grade-12":
      return "indigo";
    case "certificate":
    case "grade-9":
    case "qualification":
      return "emerald";
    case "course":
    case "grade-2":
    case "mathematics":
      return "indigo";
    case "diploma":
    case "grade-11":
      return "fuchsia";
    case "early-years":
    case "grade-1":
    case "primary-school":
      return "sky";
    case "framework":
    case "standards":
      return "violet";
    case "global-education":
    case "state":
      return "cyan";
    case "grade-10":
    case "science":
      return "amber";
    case "grade-3":
    case "grade-4":
    case "grade-5":
    case "grade-6":
      return "sky";
    case "grade-7":
    case "grade-8":
    case "middle-school":
      return "violet";
    case "high-school":
      return "amber";
    default:
      return "sky";
  }
}
