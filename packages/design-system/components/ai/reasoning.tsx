"use client";

import { ArrowDown01Icon, BrainIcon } from "@hugeicons/core-free-icons";
import { Response } from "@repo/design-system/components/ai/response";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useControllableState } from "@repo/design-system/hooks/use-controllable-state";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import {
  createContext,
  memo,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface ReasoningContextValue {
  duration: number;
  hasContent: boolean;
  isOpen: boolean;
  isStreaming: boolean;
  setIsOpen: (open: boolean) => void;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

function useReasoning() {
  const context = use(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
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
      onChange: onOpenChange,
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

    const contextValue = useMemo(
      () => ({ hasContent, isStreaming, isOpen, setIsOpen, duration }),
      [duration, hasContent, isOpen, isStreaming, setIsOpen]
    );

    function handleOpenChange(newOpen: boolean) {
      setIsOpen(newOpen);
    }

    return (
      <ReasoningContext.Provider value={contextValue}>
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

const ThinkingMessage = memo(
  ({ isStreaming, duration }: { isStreaming: boolean; duration?: number }) => {
    const t = useTranslations("Ai");
    if (isStreaming) {
      return <p>{t("thinking")}</p>;
    }
    if (duration === undefined || duration === 0) {
      return <p>{t("thought-for-a-few-seconds")}</p>;
    }
    return <p>{t("thought-for", { duration })}</p>;
  }
);
ThinkingMessage.displayName = "ThinkingMessage";

export const ReasoningTrigger = memo(
  ({ className, children, ...props }: ReasoningTriggerProps) => {
    const { hasContent, isStreaming, isOpen, duration } = useReasoning();

    return (
      <CollapsibleTrigger
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground",
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
            <ThinkingMessage duration={duration} isStreaming={isStreaming} />
            {hasContent ? (
              <HugeIcons
                className={cn(
                  "size-4 transition-transform",
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

export type ReasoningContentProps = ComponentProps<typeof CollapsiblePanel> & {
  children: string;
  id: string;
};

export const ReasoningContent = memo(
  ({ className, children, id, ...props }: ReasoningContentProps) => (
    <CollapsiblePanel
      className={cn("text-sm", "text-muted-foreground outline-none", className)}
      {...props}
    >
      <Response id={id}>{children}</Response>
    </CollapsiblePanel>
  )
);

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
