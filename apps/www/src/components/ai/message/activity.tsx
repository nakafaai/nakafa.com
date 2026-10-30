import {
  AiBrain01Icon,
  ArrowDown01Icon,
  BookOpen02Icon,
  BrainIcon,
  Calendar03Icon,
  Globe02Icon,
  MathIcon,
  Sad02Icon,
} from "@hugeicons/core-free-icons";
import { researchMaxSources } from "@repo/backend/client/nina/research";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "cn";
import { createContext, type ReactNode, use } from "react";
import { useTranslations } from "use-intl";
import type { Invocation } from "@/components/ai/message/invocation";
import { readLimitCopy } from "@/components/ai/message/limit";
import { isProblem } from "@/components/ai/message/state";

const ActivityContext = createContext<Invocation | null>(null);

/** Selects one part of the invocation for evidence rendered inside an activity. */
export function useActivity<T>(selector: (invocation: Invocation) => T) {
  const value = use(ActivityContext);
  if (!value) {
    throw new Error("Activity components must be used within Activity");
  }
  return selector(value);
}

/**
 * One capability invocation row. Live and static transcripts pass its evidence
 * as children, so this shell never loads an evidence renderer itself.
 */
export function Activity({
  children,
  invocation,
}: {
  children: ReactNode;
  invocation: Invocation;
}) {
  return (
    <ActivityContext value={invocation}>
      {/* A row with nothing to open is disabled at the root, so every part carries `data-disabled`. */}
      <Collapsible
        className="not-prose min-w-0"
        defaultOpen={false}
        disabled={invocation.artifacts.length === 0}
      >
        <ActivityTrigger />
        <CollapsibleContent className="motion-reduce:transition-none">
          {/* The line runs under the middle of the row's icon, and the evidence starts where the row's words start (8 + 1 + 15 = 24 px), so it reads as their children. */}
          <div className="ms-2 mt-3 flex min-w-0 flex-col gap-4 border-s ps-3.75">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </ActivityContext>
  );
}

function ActivityTrigger() {
  const t = useTranslations("Ai");
  const artifactCount = useActivity(
    (invocation) => invocation.artifacts.length
  );
  const capability = useActivity((invocation) => invocation.capability);
  const state = useActivity((invocation) => invocation.state);
  const problem = isProblem(state);
  // No step of an activity draws its activity's icon: the math steps have an
  // icon per operation, the calculator among them, so math has its own.
  const icon = {
    calendar: Calendar03Icon,
    math: MathIcon,
    memory: AiBrain01Icon,
    nakafa: BookOpen02Icon,
    deepResearch: Globe02Icon,
    unknown: BrainIcon,
  }[capability];
  const limitCopy = readLimitCopy(capability);
  const label = {
    denied: t("activity.denied"),
    done: t(`activity.${capability}`),
    empty: t(`activity.${capability}`),
    failed: t(`tool-failures.${capability}`),
    limit:
      limitCopy === null
        ? t(`activity.${capability}`)
        : t(limitCopy, { count: researchMaxSources }),
    partial: t(`activity.${capability}`),
    running: t(`activity.${capability}`),
    stopped: t(`activity.${capability}`),
  }[state];
  const note = {
    denied: undefined,
    done: undefined,
    empty: t("activity.empty"),
    failed: undefined,
    limit: undefined,
    partial: t("activity.partial"),
    running: undefined,
    stopped: t("activity.stopped"),
  }[state];
  return (
    <CollapsibleTrigger
      aria-atomic="true"
      aria-live="polite"
      className={cn(
        "group/activity flex min-h-6 w-fit max-w-full items-start gap-2 rounded-sm py-0.5 text-start text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
        problem
          ? "text-destructive"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Spinner
        aria-hidden="true"
        className="mt-0.5 size-4"
        icon={problem ? Sad02Icon : icon}
        isLoading={state === "running"}
      />
      {/* A line says one fact, so the note has its own line under the label. Either wraps in a narrow row instead of being cut. */}
      <span className="flex min-w-0 flex-col">
        <span data-slot="activity-label">{label}</span>
        {note ? (
          <span className="text-xs" data-slot="activity-note">
            {note}
          </span>
        ) : null}
      </span>
      {artifactCount > 0 ? (
        <HugeIcons
          className="mt-0.5 size-4 shrink-0 transition-transform group-data-panel-open/activity:rotate-180 motion-reduce:transition-none"
          icon={ArrowDown01Icon}
        />
      ) : null}
    </CollapsibleTrigger>
  );
}
