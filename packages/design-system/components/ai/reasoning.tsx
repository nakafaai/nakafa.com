"use client";

import { ArrowDown01Icon, BrainIcon } from "@hugeicons/core-free-icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useControllableState } from "@repo/design-system/hooks/use-controllable-state";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { memo, useEffect, useRef, useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";

interface ReasoningContextValue {
  duration: number;
  hasContent: boolean;
  isOpen: boolean;
  isStreaming: boolean;
}

const missingReasoning = Symbol("missing-reasoning");

const ReasoningContext = createContext<
  ReasoningContextValue | typeof missingReasoning
>(missingReasoning);

/** Selects one part of the surrounding reasoning state. */
function useReasoning<T>(selector: (reasoning: ReasoningContextValue) => T) {
  const selected = useContextSelector(ReasoningContext, (value) =>
    value === missingReasoning ? missingReasoning : selector(value)
  );
  if (selected === missingReasoning) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return selected;
}

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  hasContent?: boolean;
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

interface ReasoningTiming {
  duration: number;
  isStreaming: boolean;
  startedAt: number | null;
}

export const Reasoning = memo(
  ({
    className,
    hasContent = true,
    isStreaming = false,
    open,
    defaultOpen = true,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      ...(onOpenChange === undefined ? {} : { onChange: onOpenChange }),
    });
    const hasAutoClosedRef = useRef(false);
    const [timing, setTiming] = useState<ReasoningTiming>(() => ({
      duration: 0,
      isStreaming,
      startedAt: isStreaming ? Date.now() : null,
    }));

    if (timing.isStreaming !== isStreaming) {
      const duration =
        isStreaming || timing.startedAt === null
          ? timing.duration
          : Math.ceil((Date.now() - timing.startedAt) / MS_IN_S);

      setTiming({
        duration,
        isStreaming,
        startedAt: isStreaming ? Date.now() : null,
      });
    }

    const duration = durationProp ?? timing.duration;

    // Auto-open when streaming starts, auto-close when streaming ends (once only)
    useEffect(() => {
      if (defaultOpen && !isStreaming && isOpen && !hasAutoClosedRef.current) {
        // Add a small delay before closing to allow user to see the content
        const timer = setTimeout(() => {
          setIsOpen(false);
          hasAutoClosedRef.current = true;
        }, AUTO_CLOSE_DELAY);

        return () => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, defaultOpen, setIsOpen]);

    function handleOpenChange(newOpen: boolean) {
      setIsOpen(newOpen);
    }

    return (
      <ReasoningContext.Provider
        value={{ duration, hasContent, isOpen, isStreaming }}
      >
        <Collapsible
          className={cn("not-prose flex flex-col gap-2", className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    );
  }
);

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger>;

const ThinkingMessage = memo(() => {
  const t = useTranslations("Ai");
  const duration = useReasoning((reasoning) => reasoning.duration);
  const isStreaming = useReasoning((reasoning) => reasoning.isStreaming);
  if (isStreaming) {
    return <p>{t("thinking")}</p>;
  }
  if (duration === 0) {
    return <p>{t("thought-for-a-few-seconds")}</p>;
  }
  return <p>{t("thought-for", { duration })}</p>;
});
ThinkingMessage.displayName = "ThinkingMessage";

export const ReasoningTrigger = memo(
  ({ className, children, ...props }: ReasoningTriggerProps) => {
    const hasContent = useReasoning((reasoning) => reasoning.hasContent);
    const isOpen = useReasoning((reasoning) => reasoning.isOpen);
    const isStreaming = useReasoning((reasoning) => reasoning.isStreaming);

    return (
      <CollapsibleTrigger
        className={cn(
          "flex w-fit max-w-full cursor-pointer items-center gap-2 text-start text-muted-foreground text-sm transition-colors hover:text-foreground",
          !hasContent && "cursor-default hover:text-muted-foreground",
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <Spinner
              className="size-4"
              icon={BrainIcon}
              isLoading={isStreaming}
            />
            <ThinkingMessage />
            {hasContent ? (
              <HugeIcons
                className={cn(
                  "size-4 shrink-0 transition-transform",
                  isOpen ? "rotate-180" : "rotate-0"
                )}
                icon={ArrowDown01Icon}
              />
            ) : null}
          </>
        )}
      </CollapsibleTrigger>
    );
  }
);

export type ReasoningContentProps = ComponentProps<typeof CollapsibleContent>;

/** Frames rendered reasoning; streamed and static callers choose the renderer. */
export const ReasoningContent = memo(
  ({ className, ...props }: ReasoningContentProps) => (
    <CollapsibleContent
      className={cn("text-sm", "text-muted-foreground outline-none", className)}
      {...props}
    />
  )
);

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
