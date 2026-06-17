import {
  Atom02Icon,
  BookOpen02Icon,
  Books02Icon,
  Brain02Icon,
  CalculatorIcon,
  Chemistry01Icon,
  DiplomaIcon,
  DnaIcon,
  Globe02Icon,
  MicroscopeIcon,
  Mortarboard01Icon,
  PiIcon,
  QuillWrite02Icon,
  SchoolIcon,
} from "@hugeicons/core-free-icons";
import type { Grade } from "@repo/contents/_types/taxonomy";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { FC } from "react";

/** Renders the established grade-card illustration for lower grade rows. */
export function Grade7Icon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-col gap-1.5 rounded-md border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="flex items-center justify-between">
          <div className="size-4 rounded-lg bg-sky-500/20 dark:bg-sky-400/20" />
          <div className="h-1 w-6 rounded-full bg-sky-500/20 dark:bg-sky-400/20" />
        </div>
        <div className="h-1 w-full rounded-full bg-sky-500/20 dark:bg-sky-400/20" />
        <div className="h-1 w-2/3 rounded-full bg-sky-500/20 dark:bg-sky-400/20" />

        <div className="absolute top-2 -right-2 flex size-6 items-center justify-center rounded-full border-2 border-card bg-sky-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:bg-sky-600">
          <HugeIcons className="size-3.5" icon={Books02Icon} />
        </div>

        <div className="absolute -bottom-2 -left-2 flex size-9 items-center justify-center rounded-full border-2 border-card bg-sky-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-sky-600">
          <HugeIcons className="size-4.5" icon={BookOpen02Icon} />
        </div>
      </div>
    </div>
  );
}

/** Renders the established grade-card illustration for grade 8 rows. */
export function Grade8Icon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-col justify-end gap-1.5 rounded-md border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="h-1 w-3/4 rounded-full bg-violet-500/20 dark:bg-violet-400/20" />
        <div className="flex gap-1">
          <div className="h-4 w-1/2 rounded-md bg-violet-500/20 dark:bg-violet-400/20" />
          <div className="h-4 w-1/2 rounded-md bg-violet-500/20 dark:bg-violet-400/20" />
        </div>

        <div className="absolute top-1/2 -right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border-2 border-card bg-violet-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:scale-110 dark:bg-violet-600">
          <HugeIcons className="size-3.5" icon={QuillWrite02Icon} />
        </div>

        <div className="absolute -bottom-2 -left-2 flex size-9 items-center justify-center rounded-full border-2 border-card bg-violet-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-violet-600">
          <HugeIcons className="size-4.5" icon={CalculatorIcon} />
        </div>
      </div>
    </div>
  );
}

/** Renders the established grade-card illustration for grade 9 rows. */
export function Grade9Icon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-col items-end gap-2 rounded-md border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="size-3 rounded-full bg-emerald-500/20 dark:bg-emerald-400/20" />
        <div className="h-1 w-full rounded-full bg-emerald-500/20 dark:bg-emerald-400/20" />
        <div className="h-1 w-4/5 rounded-full bg-emerald-500/20 dark:bg-emerald-400/20" />

        <div className="absolute -right-2 -bottom-2 flex size-6 items-center justify-center rounded-full border-2 border-card bg-emerald-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-emerald-600">
          <HugeIcons className="size-3.5" icon={MicroscopeIcon} />
        </div>

        <div className="absolute top-1 -left-2 flex size-9 items-center justify-center rounded-full border-2 border-card bg-emerald-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:bg-emerald-600">
          <HugeIcons className="size-4.5" icon={Chemistry01Icon} />
        </div>
      </div>
    </div>
  );
}

/** Renders the established grade-card illustration for grade 10 rows. */
export function Grade10Icon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-col items-center justify-center gap-1.5 rounded-md border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="flex gap-1.5">
          <div className="size-3 rounded-full bg-amber-500/20 dark:bg-amber-400/20" />
          <div className="size-3 rounded-full bg-amber-500/20 dark:bg-amber-400/20" />
        </div>
        <div className="h-1 w-full rounded-full bg-amber-500/20 dark:bg-amber-400/20" />

        <div className="absolute top-0 -right-2 flex size-6 items-center justify-center rounded-full border-2 border-card bg-amber-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:bg-amber-600">
          <HugeIcons className="size-3.5" icon={Brain02Icon} />
        </div>

        <div className="absolute -bottom-2 -left-2 flex size-9 items-center justify-center rounded-full border-2 border-card bg-amber-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-amber-600">
          <HugeIcons className="size-4.5" icon={Atom02Icon} />
        </div>
      </div>
    </div>
  );
}

/** Renders the established grade-card illustration for grade 11 rows. */
export function Grade11Icon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-col gap-1.5 rounded-md border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="h-1 w-full rounded-full bg-fuchsia-500/20 dark:bg-fuchsia-400/20" />
        <div className="h-4 w-full rounded-md bg-fuchsia-500/20 dark:bg-fuchsia-400/20" />
        <div className="h-1 w-2/3 rounded-full bg-fuchsia-500/20 dark:bg-fuchsia-400/20" />

        <div className="absolute -right-1.5 bottom-1 flex size-6 items-center justify-center rounded-full border-2 border-card bg-fuchsia-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:bg-fuchsia-600">
          <HugeIcons className="size-3.5" icon={Globe02Icon} />
        </div>

        <div className="absolute -bottom-2 -left-2 flex size-9 items-center justify-center rounded-full border-2 border-card bg-fuchsia-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-fuchsia-600">
          <HugeIcons className="size-4.5" icon={DnaIcon} />
        </div>
      </div>
    </div>
  );
}

/** Renders the established grade-card illustration for grade 12 rows. */
export function Grade12Icon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-row gap-1.5 rounded-md border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="h-full w-2 rounded-full bg-indigo-500/20 dark:bg-indigo-400/20" />
        <div className="flex flex-1 flex-col justify-between py-0.5">
          <div className="h-1 w-full rounded-full bg-indigo-500/20 dark:bg-indigo-400/20" />
          <div className="h-1 w-full rounded-full bg-indigo-500/20 dark:bg-indigo-400/20" />
          <div className="h-1 w-full rounded-full bg-indigo-500/20 dark:bg-indigo-400/20" />
        </div>

        <div className="absolute top-2 -right-2 flex size-6 items-center justify-center rounded-full border-2 border-card bg-indigo-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:bg-indigo-600">
          <HugeIcons className="size-3.5" icon={PiIcon} />
        </div>

        <div className="absolute -bottom-2 -left-2 flex size-9 items-center justify-center rounded-full border-2 border-card bg-indigo-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-indigo-600">
          <HugeIcons className="size-4.5" icon={SchoolIcon} />
        </div>
      </div>
    </div>
  );
}

/** Renders the established grade-card illustration for higher-ed rows. */
export function BachelorIcon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-col justify-center gap-1.5 rounded-md border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="mx-auto h-2 w-8 rounded-full bg-cyan-500/20 dark:bg-cyan-400/20" />
        <div className="mx-auto h-1 w-6 rounded-full bg-cyan-500/20 dark:bg-cyan-400/20" />
        <div className="mx-auto h-1 w-4 rounded-full bg-cyan-500/20 dark:bg-cyan-400/20" />

        <div className="absolute top-1 -right-2 flex size-6 items-center justify-center rounded-full border-2 border-card bg-cyan-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:bg-cyan-600">
          <HugeIcons className="size-3.5" icon={DiplomaIcon} />
        </div>

        <div className="absolute -bottom-2 -left-2 flex size-9 items-center justify-center rounded-full border-2 border-card bg-cyan-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-cyan-600">
          <HugeIcons className="size-4.5" icon={Mortarboard01Icon} />
        </div>
      </div>
    </div>
  );
}

/**
 * Selects the established grade-card illustration for one source grade value.
 *
 * This keeps curriculum class rows visually aligned with the old subject root
 * while the public URL is generated from the new curriculum projection.
 */
export function getGradeIcon(grade: Grade): FC {
  switch (grade) {
    case "8":
      return Grade8Icon;
    case "9":
      return Grade9Icon;
    case "10":
      return Grade10Icon;
    case "11":
      return Grade11Icon;
    case "12":
      return Grade12Icon;
    case "bachelor":
    case "master":
    case "phd":
      return BachelorIcon;
    default:
      return Grade7Icon;
  }
}

/**
 * Selects a grade illustration from a source-owned curriculum class node key.
 *
 * Returns `null` for non-class rows so subject/topic rendering can use the
 * material/domain icon contract instead of guessing from display text.
 */
export function getCurriculumGradeIcon(nodeKey: string) {
  if (nodeKey.endsWith("class-10")) {
    return Grade10Icon;
  }

  if (nodeKey.endsWith("class-11")) {
    return Grade11Icon;
  }

  if (nodeKey.endsWith("class-12")) {
    return Grade12Icon;
  }

  return null;
}
