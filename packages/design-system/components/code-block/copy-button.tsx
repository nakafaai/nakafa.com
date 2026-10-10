"use client";

import { Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { captureException } from "@repo/analytics/posthog/browser";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type {
  CodeClipboardUnavailableError,
  CodeClipboardWriteError,
} from "@repo/design-system/lib/code-block/clipboard";
import { writeCodeToClipboard } from "@repo/design-system/lib/code-block/clipboard";
import { useCodeBlock } from "@repo/design-system/lib/code-block/context";
import { cn } from "cn";
import { Array as Arr, Duration, Effect, Fiber, Option } from "effect";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";

/** Copy callbacks and duration for the transient success state. */
type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

/** Copies the active source and exposes success and failure feedback. */
export function CodeBlockCopyButton({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const copyFiberRef = useRef<Fiber.Fiber<void, never> | null>(null);
  // The selector returns a string or undefined: a store selector must return a
  // stable value, and an Option is a new object on every call.
  const code = useCodeBlock(
    (state) =>
      Option.getOrUndefined(
        Arr.findFirst(state.data, (item) => item.language === state.value)
      )?.code
  );

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
    if (typeof window === "undefined" || !code) {
      return;
    }

    const handleUnavailableError = (error: CodeClipboardUnavailableError) =>
      Effect.sync(() => {
        setIsCopied(false);
        captureException(error, { source: "code-block-copy" });
        onError?.(error);
      });
    const handleWriteError = (error: CodeClipboardWriteError) =>
      Effect.sync(() => {
        const cause = error.cause instanceof Error ? error.cause : error;

        setIsCopied(false);
        captureException(cause, { source: "code-block-copy" });
        onError?.(cause);
      });
    const copyProgram = Effect.gen(function* () {
      yield* writeCodeToClipboard(navigator.clipboard, code);
      yield* Effect.sync(() => {
        setIsCopied(true);
        onCopy?.();
      });
      yield* Effect.sleep(Duration.millis(timeout));
      yield* Effect.sync(() => setIsCopied(false));
    }).pipe(
      Effect.catchTags({
        CodeClipboardUnavailableError: handleUnavailableError,
        CodeClipboardWriteError: handleWriteError,
      })
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
}
