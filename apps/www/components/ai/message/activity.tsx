"use client";

import {
  ArrowDown01Icon,
  BookOpen02Icon,
  BrainIcon,
  Calculator01Icon,
  Globe02Icon,
  Sad02Icon,
} from "@hugeicons/core-free-icons";
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
          <div className="flex min-w-0 flex-col gap-3 ps-6 pt-3">
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
  const denied = useActivity((invocation) => invocation.denied);
  const failed = useActivity((invocation) => invocation.failed);
  const failures = useActivity((invocation) => invocation.failures);
  const running = useActivity((invocation) => invocation.running);
  const sourceLimit = useActivity((invocation) => invocation.sourceLimit);
  const stopped = useActivity((invocation) => invocation.stopped);
  const icon = {
    math: Calculator01Icon,
    nakafa: BookOpen02Icon,
    deepResearch: Globe02Icon,
    unknown: BrainIcon,
  }[capability];
  let label = t(`activity.${capability}`);
  if (sourceLimit !== undefined) {
    label = t("activity.source-limit", { count: sourceLimit });
  } else if (failed) {
    label = t(`tool-failures.${capability}`);
  } else if (denied) {
    label = t("activity.denied");
  }
  return (
    <CollapsibleTrigger
      aria-atomic="true"
      aria-live="polite"
      className={cn(
        "group/activity flex min-h-6 w-fit max-w-full items-center gap-2 rounded-sm text-start text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
        failed || denied
          ? "text-destructive"
          : "text-muted-foreground hover:text-foreground"
      )}
      disabled={artifactCount === 0}
    >
      <Spinner
        aria-hidden="true"
        className="size-4"
        icon={failed || denied ? Sad02Icon : icon}
        isLoading={running}
      />
      <span className="min-w-0 truncate" title={label}>
        {label}
      </span>
      {failures > 0 ? (
        <span className="shrink-0 text-destructive text-xs tabular-nums">
          {t("activity.failures", { count: failures })}
        </span>
      ) : null}
      {stopped ? (
        <span className="shrink-0 text-xs">{t("activity.stopped")}</span>
      ) : null}
      {artifactCount > 0 ? (
        <HugeIcons
          className="size-4 shrink-0 transition-transform group-data-panel-open/activity:rotate-180 motion-reduce:transition-none"
          icon={ArrowDown01Icon}
        />
      ) : null}
    </CollapsibleTrigger>
  );
}
