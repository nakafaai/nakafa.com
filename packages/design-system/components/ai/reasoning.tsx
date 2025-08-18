"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { cn } from "@repo/design-system/lib/utils";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { memo, useEffect, useMemo, useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { Response } from "./response";

const AUTO_CLOSE_DELAY = 1000;
const DURATION_FACTOR = 1000;

type ReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

function useReasoning<T>(selector: (state: ReasoningContextValue) => T): T {
  const context = useContextSelector(ReasoningContext, (v) => v);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return selector(context);
}

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = false,
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
    const [duration, setDuration] = useControllableState({
      prop: durationProp,
      defaultProp: 0,
    });

    const [hasAutoClosedRef, setHasAutoClosedRef] = useState(false);
    const [wasAutoOpened, setWasAutoOpened] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          setStartTime(Date.now());
        }
      } else if (startTime !== null) {
        setDuration(Math.round((Date.now() - startTime) / DURATION_FACTOR));
        setStartTime(null);
      }
    }, [isStreaming, startTime, setDuration]);

    // Auto-open when streaming starts, auto-close when streaming ends (once only).
    // Do NOT auto-close if the user manually opened the panel when there was no streaming.
    useEffect(() => {
      if (isStreaming && !isOpen) {
        setIsOpen(true);
        setWasAutoOpened(true);
      } else if (
        !isStreaming &&
        isOpen &&
        !defaultOpen &&
        !hasAutoClosedRef &&
        wasAutoOpened
      ) {
        // Add a small delay before closing to allow user to see the content
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosedRef(true);
          setWasAutoOpened(false);
        }, AUTO_CLOSE_DELAY);
        return () => clearTimeout(timer);
      }
    }, [
      isStreaming,
      isOpen,
      defaultOpen,
      setIsOpen,
      hasAutoClosedRef,
      wasAutoOpened,
    ]);

    const handleOpenChange = (v: boolean) => {
      setIsOpen(v);
    };

    const value = useMemo(
      () => ({ isStreaming, isOpen, setIsOpen, duration }),
      [isStreaming, isOpen, setIsOpen, duration]
    );

    return (
      <ReasoningContext.Provider value={value}>
        <Collapsible
          className={cn("not-prose", className)}
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

export type ReasoningTriggerProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  title?: string;
};

export const ReasoningTrigger = memo(
  ({
    className,
    title = "Reasoning",
    children,
    ...props
  }: ReasoningTriggerProps) => {
    const t = useTranslations("Ai");
    const isStreaming = useReasoning((v) => v.isStreaming);
    const isOpen = useReasoning((v) => v.isOpen);
    const duration = useReasoning((v) => v.duration);

    return (
      <CollapsibleTrigger
        className={cn(
          "flex items-center gap-2 text-muted-foreground text-sm",
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon className="size-4" />
            {isStreaming || duration === 0 ? (
              <p>{t("thinking")}</p>
            ) : (
              <p>{t("thought-for", { duration })}</p>
            )}
            <ChevronDownIcon
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                isOpen ? "rotate-180" : "rotate-0"
              )}
            />
          </>
        )}
      </CollapsibleTrigger>
    );
  }
);

export type ReasoningContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  children: string;
  id: string;
};

export const ReasoningContent = memo(
  ({ className, children, id, ...props }: ReasoningContentProps) => (
    <CollapsibleContent
      className={cn(
        "mt-4 text-sm",
        "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
        className
      )}
      {...props}
    >
      <Response className="text-muted-foreground text-sm" id={id}>
        {children}
      </Response>
    </CollapsibleContent>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
