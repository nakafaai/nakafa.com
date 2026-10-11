"use client";

import {
  ArrowDown01Icon,
  BookOpen02Icon,
  BrainIcon,
  Calculator01Icon,
  Globe02Icon,
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
import { useTranslations } from "next-intl";
import { createContext, type ReactNode, use } from "react";
import type { Invocation } from "@/components/ai/message/invocation";
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
      <Collapsible className="not-prose min-w-0" defaultOpen={false}>
        <ActivityTrigger />
        <CollapsibleContent className="motion-reduce:transition-none">
          {/* The line starts under the row's icon, so the evidence reads as its children. */}
          <div className="ms-2 mt-3 flex min-w-0 flex-col gap-3 border-s ps-4">
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
  const icon = {
    math: Calculator01Icon,
    nakafa: BookOpen02Icon,
    deepResearch: Globe02Icon,
    unknown: BrainIcon,
  }[capability];
  const label = {
    denied: t("activity.denied"),
    done: t(`activity.${capability}`),
    empty: t(`activity.${capability}`),
    failed: t(`tool-failures.${capability}`),
    limit: t("activity.source-limit", { count: researchMaxSources }),
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
        "group/activity flex min-h-6 w-fit max-w-full items-center gap-2 rounded-sm text-start text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
        problem
          ? "text-destructive"
          : "text-muted-foreground hover:text-foreground"
      )}
      disabled={artifactCount === 0}
    >
      <Spinner
        aria-hidden="true"
        className="size-4"
        icon={problem ? Sad02Icon : icon}
        isLoading={state === "running"}
      />
      <span className="min-w-0 truncate" title={label}>
        {label}
      </span>
      {note ? <span className="shrink-0 text-xs">{note}</span> : null}
      {artifactCount > 0 ? (
        <HugeIcons
          className="size-4 shrink-0 transition-transform group-data-panel-open/activity:rotate-180 motion-reduce:transition-none"
          icon={ArrowDown01Icon}
        />
      ) : null}
    </CollapsibleTrigger>
  );
}
