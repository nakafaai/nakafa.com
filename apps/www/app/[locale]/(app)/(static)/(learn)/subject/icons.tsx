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
import type { Grade } from "@repo/contents/_types/subject/grade";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";

export function Grade7Icon() {
  return (
    <div className="relative flex h-24 w-28 items-center justify-center">
      <div className="relative flex h-18 w-20 flex-col gap-1.5 rounded-lg border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="flex items-center justify-between">
          <div className="h-4 w-4 rounded-lg bg-sky-500/20 dark:bg-sky-400/20" />
          <div className="h-1 w-6 rounded-full bg-sky-500/20 dark:bg-sky-400/20" />
        </div>
        <div className="h-1 w-full rounded-full bg-sky-500/20 dark:bg-sky-400/20" />
        <div className="h-1 w-2/3 rounded-full bg-sky-500/20 dark:bg-sky-400/20" />

        <div className="absolute top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-sky-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:bg-sky-600">
          <HugeIcons className="size-4.5" icon={Books02Icon} />
        </div>

        <div className="absolute -bottom-2 -left-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-card bg-sky-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-sky-600">
          <HugeIcons className="size-5.5" icon={BookOpen02Icon} />
        </div>
      </div>
    </div>
  );
}

export function Grade8Icon() {
  return (
    <div className="relative flex h-24 w-28 items-center justify-center">
      <div className="relative flex h-18 w-20 flex-col justify-end gap-1.5 rounded-lg border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="h-1 w-3/4 rounded-full bg-violet-500/20 dark:bg-violet-400/20" />
        <div className="flex gap-1">
          <div className="h-4 w-1/2 rounded-md bg-violet-500/20 dark:bg-violet-400/20" />
          <div className="h-4 w-1/2 rounded-md bg-violet-500/20 dark:bg-violet-400/20" />
        </div>

        <div className="absolute top-1/2 -right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-card bg-violet-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:scale-110 dark:bg-violet-600">
          <HugeIcons className="size-4.5" icon={QuillWrite02Icon} />
        </div>

        <div className="absolute -bottom-2 -left-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-card bg-violet-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-violet-600">
          <HugeIcons className="size-5.5" icon={CalculatorIcon} />
        </div>
      </div>
    </div>
  );
}

export function Grade9Icon() {
  return (
    <div className="relative flex h-24 w-28 items-center justify-center">
      <div className="relative flex h-18 w-20 flex-col items-end gap-2 rounded-lg border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="h-3 w-3 rounded-full bg-emerald-500/20 dark:bg-emerald-400/20" />
        <div className="h-1 w-full rounded-full bg-emerald-500/20 dark:bg-emerald-400/20" />
        <div className="h-1 w-4/5 rounded-full bg-emerald-500/20 dark:bg-emerald-400/20" />

        <div className="absolute -right-2 -bottom-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-emerald-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-emerald-600">
          <HugeIcons className="size-4.5" icon={MicroscopeIcon} />
        </div>

        <div className="absolute top-1 -left-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-card bg-emerald-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:bg-emerald-600">
          <HugeIcons className="size-5.5" icon={Chemistry01Icon} />
        </div>
      </div>
    </div>
  );
}

export function Grade10Icon() {
  return (
    <div className="relative flex h-24 w-28 items-center justify-center">
      <div className="relative flex h-18 w-20 flex-col items-center justify-center gap-1.5 rounded-lg border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-amber-500/20 dark:bg-amber-400/20" />
          <div className="h-3 w-3 rounded-full bg-amber-500/20 dark:bg-amber-400/20" />
        </div>
        <div className="h-1 w-full rounded-full bg-amber-500/20 dark:bg-amber-400/20" />

        <div className="absolute top-0 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-amber-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:bg-amber-600">
          <HugeIcons className="size-4.5" icon={Brain02Icon} />
        </div>

        <div className="absolute -bottom-2 -left-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-card bg-amber-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-amber-600">
          <HugeIcons className="size-5.5" icon={Atom02Icon} />
        </div>
      </div>
    </div>
  );
}

export function Grade11Icon() {
  return (
    <div className="relative flex h-24 w-28 items-center justify-center">
      <div className="relative flex h-18 w-20 flex-col gap-1.5 rounded-lg border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="h-1 w-full rounded-full bg-fuchsia-500/20 dark:bg-fuchsia-400/20" />
        <div className="h-4 w-full rounded-md bg-fuchsia-500/20 dark:bg-fuchsia-400/20" />
        <div className="h-1 w-2/3 rounded-full bg-fuchsia-500/20 dark:bg-fuchsia-400/20" />

        <div className="absolute -right-1.5 bottom-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-fuchsia-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:bg-fuchsia-600">
          <HugeIcons className="size-4.5" icon={Globe02Icon} />
        </div>

        <div className="absolute -bottom-2.5 -left-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-card bg-fuchsia-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-fuchsia-600">
          <HugeIcons className="size-5.5" icon={DnaIcon} />
        </div>
      </div>
    </div>
  );
}

export function Grade12Icon() {
  return (
    <div className="relative flex h-24 w-28 items-center justify-center">
      <div className="relative flex h-18 w-20 flex-row gap-1.5 rounded-lg border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="h-full w-2 rounded-full bg-indigo-500/20 dark:bg-indigo-400/20" />
        <div className="flex flex-1 flex-col justify-between py-0.5">
          <div className="h-1 w-full rounded-full bg-indigo-500/20 dark:bg-indigo-400/20" />
          <div className="h-1 w-full rounded-full bg-indigo-500/20 dark:bg-indigo-400/20" />
          <div className="h-1 w-full rounded-full bg-indigo-500/20 dark:bg-indigo-400/20" />
        </div>

        <div className="absolute top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-indigo-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:bg-indigo-600">
          <HugeIcons className="size-4.5" icon={PiIcon} />
        </div>

        <div className="absolute -bottom-2 -left-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-card bg-indigo-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-indigo-600">
          <HugeIcons className="size-5.5" icon={SchoolIcon} />
        </div>
      </div>
    </div>
  );
}

export function BachelorIcon() {
  return (
    <div className="relative flex h-24 w-28 items-center justify-center">
      <div className="relative flex h-18 w-20 flex-col justify-center gap-1.5 rounded-lg border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="mx-auto h-2 w-8 rounded-full bg-cyan-500/20 dark:bg-cyan-400/20" />
        <div className="mx-auto h-1 w-6 rounded-full bg-cyan-500/20 dark:bg-cyan-400/20" />
        <div className="mx-auto h-1 w-4 rounded-full bg-cyan-500/20 dark:bg-cyan-400/20" />

        <div className="absolute top-1 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-cyan-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:bg-cyan-600">
          <HugeIcons className="size-4.5" icon={DiplomaIcon} />
        </div>

        <div className="absolute -bottom-2 -left-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-card bg-cyan-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-cyan-600">
          <HugeIcons className="size-5.5" icon={Mortarboard01Icon} />
        </div>
      </div>
    </div>
  );
}

const GRADE_ICONS: Record<Grade, React.FC> = {
  "1": Grade7Icon,
  "2": Grade7Icon,
  "3": Grade7Icon,
  "4": Grade7Icon,
  "5": Grade7Icon,
  "6": Grade7Icon,
  "7": Grade7Icon,
  "8": Grade8Icon,
  "9": Grade9Icon,
  "10": Grade10Icon,
  "11": Grade11Icon,
  "12": Grade12Icon,
  bachelor: BachelorIcon,
  master: BachelorIcon,
  phd: BachelorIcon,
};

export function getGradeIcon(grade: Grade): React.FC {
  return GRADE_ICONS[grade] ?? Grade7Icon;
}
