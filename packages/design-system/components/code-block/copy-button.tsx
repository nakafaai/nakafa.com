"use client";

import { Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { captureException } from "@repo/analytics/posthog";
import { useCodeBlock } from "@repo/design-system/components/code-block";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { writeCodeToClipboard } from "@repo/design-system/lib/code-block";
import { cn } from "@repo/design-system/lib/utils";
import { Duration, Effect, Fiber } from "effect";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

/** Copies the active source and exposes success and failure feedback. */
export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const copyFiberRef = useRef<Fiber.RuntimeFiber<void, never> | null>(null);
  const { data, value } = useCodeBlock((state) => ({
    data: state.data,
    value: state.value,
  }));
  const code = data.find((item) => item.language === value)?.code;

  useEffect(
    () => () => {
      const fiber = copyFiberRef.current;
      if (fiber) {
        Effect.runFork(Fiber.interrupt(fiber));
      }
    },
    []
  );

  function copyToClipboard() {
    if (
      typeof window === "undefined" ||
      !navigator.clipboard?.writeText ||
      !code
    ) {
      return;
    }

    const copyProgram = Effect.gen(function* () {
      yield* writeCodeToClipboard(navigator.clipboard, code);
      yield* Effect.sync(() => {
        setIsCopied(true);
        onCopy?.();
      });
      yield* Effect.sleep(Duration.millis(timeout));
      yield* Effect.sync(() => setIsCopied(false));
    }).pipe(
      Effect.catchTag("CodeClipboardWriteError", (error) =>
        Effect.sync(() => {
          const cause = error.cause instanceof Error ? error.cause : error;

          setIsCopied(false);
          captureException(cause, { source: "code-block-copy" });
          onError?.(cause);
        })
      )
    );
    const previousFiber = copyFiberRef.current;
    const nextProgram = previousFiber
      ? Fiber.interrupt(previousFiber).pipe(Effect.andThen(copyProgram))
      : copyProgram;

    copyFiberRef.current = Effect.runFork(nextProgram);
  }

  const icon = isCopied ? Tick01Icon : Copy01Icon;

  return (
    <Button
      aria-label={isCopied ? "Copied" : "Copy to clipboard"}
      className={cn("shrink-0", className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <HugeIcons className="text-muted-foreground" icon={icon} />}
      <span className="sr-only">
        {isCopied ? "Copied" : "Copy to clipboard"}
      </span>
    </Button>
  );
};
