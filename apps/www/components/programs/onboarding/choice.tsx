import {
  AiMagicIcon,
  Books02Icon,
  ClipboardIcon,
  Rocket01Icon,
  Target01Icon,
} from "@hugeicons/core-free-icons";
import type { LearningInterest } from "@repo/contents/_types/program/schema";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ToggleGroupItem } from "@repo/design-system/components/ui/toggle-group";
import { cva } from "class-variance-authority";
import type { useTranslations } from "next-intl";
import type { ProgramOption } from "./model";

type Translator = ReturnType<typeof useTranslations>;
type ChoiceTone = "assessment" | "custom" | "exam" | "nakafa" | "school";

const interestMessageKeys = {
  "assessment-prep": {
    description: "interest.assessment-prep.description",
    icon: ClipboardIcon,
    title: "interest.assessment-prep.title",
    tone: "assessment",
  },
  "custom-plan": {
    description: "interest.custom-plan.description",
    icon: AiMagicIcon,
    title: "interest.custom-plan.title",
    tone: "custom",
  },
  "exam-prep": {
    description: "interest.exam-prep.description",
    icon: Target01Icon,
    title: "interest.exam-prep.title",
    tone: "exam",
  },
  "nakafa-path": {
    description: "interest.nakafa-path.description",
    icon: Rocket01Icon,
    title: "interest.nakafa-path.title",
    tone: "nakafa",
  },
  "school-curriculum": {
    description: "interest.school-curriculum.description",
    icon: Books02Icon,
    title: "interest.school-curriculum.title",
    tone: "school",
  },
} as const satisfies Record<
  LearningInterest,
  {
    description: `interest.${LearningInterest}.description`;
    icon: typeof Books02Icon;
    title: `interest.${LearningInterest}.title`;
    tone: ChoiceTone;
  }
>;

const programKindMeta = {
  "admission-exam": { icon: Target01Icon, tone: "exam" },
  assessment: { icon: ClipboardIcon, tone: "assessment" },
  "custom-program": { icon: AiMagicIcon, tone: "custom" },
  "institution-program": { icon: Books02Icon, tone: "school" },
  "nakafa-path": { icon: Rocket01Icon, tone: "nakafa" },
  "school-curriculum": { icon: Books02Icon, tone: "school" },
} as const satisfies Record<
  ProgramOption["kind"],
  {
    icon: typeof Books02Icon;
    tone: ChoiceTone;
  }
>;

const choiceVisualVariants = cva(
  "flex size-20 shrink-0 items-center justify-center rounded-xl transition-all ease-out group-hover/tile:-translate-y-0.5 group-data-[pressed]/tile:ring-2 group-data-[pressed]/tile:ring-primary/40",
  {
    variants: {
      tone: {
        assessment: "bg-chart-5/10 group-hover/tile:bg-chart-5/15",
        custom: "bg-chart-3/15 group-hover/tile:bg-chart-3/20",
        exam: "bg-chart-2/10 group-hover/tile:bg-chart-2/15",
        nakafa: "bg-chart-3/15 group-hover/tile:bg-chart-3/20",
        school: "bg-chart-1/10 group-hover/tile:bg-chart-1/15",
      },
    },
  }
);

const choiceLineVariants = cva("h-1 rounded-full", {
  variants: {
    tone: {
      assessment: "bg-chart-5/35",
      custom: "bg-chart-3/40",
      exam: "bg-chart-2/35",
      nakafa: "bg-chart-3/40",
      school: "bg-chart-1/35",
    },
  },
});

const choiceBadgeVariants = cva(
  "absolute -bottom-2 -left-2 flex size-9 items-center justify-center rounded-full border-2 border-card text-background shadow-xs transition-all ease-out group-hover/tile:-translate-x-1 group-hover/tile:translate-y-1 group-hover/tile:scale-110",
  {
    variants: {
      tone: {
        assessment: "bg-chart-5",
        custom: "bg-chart-3",
        exam: "bg-chart-2",
        nakafa: "bg-chart-3",
        school: "bg-chart-1",
      },
    },
  }
);

/** Renders one learner-facing interest tile for the first onboarding step. */
export function InterestChoice({
  interest,
  t,
}: {
  interest: LearningInterest;
  t: Translator;
}) {
  const meta = interestMessageKeys[interest];

  return (
    <ToggleGroupItem
      aria-label={t(meta.title)}
      className="group/tile h-auto min-h-0 items-center justify-start gap-4 rounded-xl border bg-card/40 p-4 text-left shadow-none hover:bg-card/70 data-pressed:border-primary/45 data-pressed:bg-primary/5"
      value={interest}
    >
      <ChoiceVisual icon={meta.icon} tone={meta.tone} />
      <span className="flex flex-1 flex-col gap-1">
        <span className="text-wrap font-medium text-base">{t(meta.title)}</span>
        <span className="text-pretty text-muted-foreground text-sm leading-snug">
          {t(meta.description)}
        </span>
      </span>
    </ToggleGroupItem>
  );
}

/** Renders one concrete route tile for the selected learner focus. */
export function ProgramChoice({ program }: { program: ProgramOption }) {
  const meta = programKindMeta[program.kind];

  return (
    <ToggleGroupItem
      aria-label={program.title}
      className="group/tile h-auto min-h-0 items-center justify-start gap-4 rounded-xl border bg-card/40 p-4 text-left shadow-none hover:bg-card/70 data-pressed:border-primary/45 data-pressed:bg-primary/5"
      value={program.key}
    >
      <ChoiceVisual icon={meta.icon} tone={meta.tone} />
      <span className="flex flex-1 flex-col gap-1">
        <span className="text-wrap font-medium text-base">{program.title}</span>
        <span className="text-pretty text-muted-foreground text-sm leading-snug">
          {program.description}
        </span>
      </span>
    </ToggleGroupItem>
  );
}

/** Shows the selected first option on the confirmation step. */
export function ProgramPreview({
  label,
  program,
}: {
  label: string;
  program: ProgramOption;
}) {
  const meta = programKindMeta[program.kind];

  return (
    <div className="grid gap-5 sm:grid-cols-[5rem_1fr] sm:items-center">
      <ChoiceVisual icon={meta.icon} tone={meta.tone} />
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">{label}</p>
        <h2 className="font-medium text-2xl tracking-tight">{program.title}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {program.description}
        </p>
      </div>
    </div>
  );
}

/** Draws the soft visual tile language used by Nakafa home discovery cards. */
function ChoiceVisual({
  icon,
  tone,
}: {
  icon: typeof Books02Icon;
  tone: ChoiceTone;
}) {
  return (
    <div className={choiceVisualVariants({ tone })}>
      <div className="relative flex h-14 w-16 items-center justify-center">
        <div className="relative flex h-11 w-14 flex-col gap-1.5 rounded-md border bg-card p-2 shadow-xs transition-all ease-out group-hover/tile:-translate-y-1">
          <div className={choiceLineVariants({ tone })} />
          <div className={choiceLineVariants({ tone, className: "w-3/4" })} />
          <div className={choiceLineVariants({ tone, className: "w-1/2" })} />

          <div className={choiceBadgeVariants({ tone })}>
            <HugeIcons className="size-4" icon={icon} />
          </div>
        </div>
      </div>
    </div>
  );
}
