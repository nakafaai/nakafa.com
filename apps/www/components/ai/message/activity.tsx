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
  type CapabilityArtifact,
  CapabilityOutputSchema,
} from "@repo/backend/confect/nina/capability/progress";
import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
import { researchMaxSources } from "@repo/backend/confect/nina/research/schema";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { type DynamicToolUIPart, getToolName, type ToolUIPart } from "ai";
import { cn } from "cn";
import { Match, Result, Schema } from "effect";
import { useTranslations } from "next-intl";
import { createContext, use } from "react";
import { useMessage } from "@/components/ai/message/context";
import { MathPart } from "@/components/ai/message/evidence/math/view";
import { NakafaPart } from "@/components/ai/message/evidence/nakafa/view";
import { ScrapeUrlPart } from "@/components/ai/message/evidence/scrape";
import { WebSearchPart } from "@/components/ai/message/evidence/web";

const ActivityContext = createContext<ReturnType<typeof readActivity> | null>(
  null
);

function useActivity() {
  const context = use(ActivityContext);
  if (!context) {
    throw new Error("Activity components must be used within NinaActivity");
  }
  return context;
}

/** One native Agent invocation owns its live progress and persisted evidence. */
export function NinaActivity({
  part,
}: {
  part: ToolUIPart | DynamicToolUIPart;
}) {
  const status = useMessage((state) => state.turn?.state.status);
  const settled =
    status === "cancelled" || status === "failed" || status === "complete";
  const activity = readActivity(part, settled);
  return (
    <ActivityContext value={activity}>
      <Collapsible className="not-prose min-w-0" defaultOpen={false}>
        <ActivityTrigger />
        <CollapsibleContent className="motion-reduce:transition-none">
          <ActivityEvidence />
        </CollapsibleContent>
      </Collapsible>
    </ActivityContext>
  );
}

function ActivityTrigger() {
  const t = useTranslations("Ai");
  const {
    artifacts,
    capability,
    denied,
    failed,
    failures,
    running,
    stopped,
    sourceLimit,
  } = useActivity();
  const icon = {
    math: Calculator01Icon,
    nakafa: BookOpen02Icon,
    deepResearch: Globe02Icon,
    unknown: BrainIcon,
  }[capability];
  let label = t(`activity.${capability}`);
  if (sourceLimit) {
    label = t("activity.source-limit", { count: researchMaxSources });
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
      disabled={artifacts.length === 0}
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
      {artifacts.length > 0 ? (
        <HugeIcons
          className="size-4 shrink-0 transition-transform group-data-panel-open/activity:rotate-180 motion-reduce:transition-none"
          icon={ArrowDown01Icon}
        />
      ) : null}
    </CollapsibleTrigger>
  );
}

function ActivityEvidence() {
  const { artifacts } = useActivity();
  return (
    <div className="flex min-w-0 flex-col gap-3 ps-6 pt-3">
      {artifacts.map((artifact) => (
        <Evidence artifact={artifact} key={`${artifact.type}:${artifact.id}`} />
      ))}
    </div>
  );
}

function Evidence({ artifact }: { artifact: CapabilityArtifact }) {
  const t = useTranslations("Ai");
  const { denied, failed, running } = useActivity();
  if (artifact.data.status === "loading" && !running) {
    return (
      <p
        className={cn(
          "text-sm",
          failed || denied ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {t("activity.stopped")}
      </p>
    );
  }
  return Match.value(artifact).pipe(
    Match.discriminatorsExhaustive("type")({
      "data-math": ({ data }) => <MathPart message={data} />,
      "data-nakafa": ({ data }) => <NakafaPart message={data} />,
      "data-scrape-url": ({ data }) => <ScrapeUrlPart message={data} />,
      "data-web-search": ({ data }) => <WebSearchPart message={data} />,
    })
  );
}

/** Validate the SDK result at its rendering boundary; never infer failure from prose. */
function readActivity(part: ToolUIPart | DynamicToolUIPart, settled: boolean) {
  const name = getToolName(part);
  const result =
    part.state === "output-available"
      ? Schema.decodeUnknownResult(CapabilityOutputSchema)(part.output)
      : undefined;
  const output =
    result && Result.isSuccess(result) ? result.success : undefined;
  const artifacts = output?.artifacts ?? [];
  const unfinished =
    part.state === "input-streaming" ||
    part.state === "input-available" ||
    (part.state === "output-available" && part.preliminary === true);
  return {
    artifacts,
    capability: Schema.is(LearningCapabilityNameSchema)(name)
      ? name
      : ("unknown" as const),
    failed:
      part.state === "output-error" ||
      output?.failure === "failed" ||
      output?.failure === "sourceLimit" ||
      (result !== undefined && Result.isFailure(result)),
    sourceLimit: output?.failure === "sourceLimit",
    denied: part.state === "output-denied" || output?.failure === "denied",
    failures: artifacts.filter((artifact) => artifact.data.status === "error")
      .length,
    running: unfinished && !settled,
    stopped: unfinished && settled,
  };
}
