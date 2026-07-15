"use client";

import { captureException } from "@repo/analytics/posthog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { cn } from "@repo/design-system/lib/utils";
import { Effect, Fiber, Schema } from "effect";
import type { MermaidConfig } from "mermaid";
import { useTheme } from "next-themes";
import { useEffect, useId, useRef, useState } from "react";

const HASH_SEED = 0;
const SHIFT_5 = 5;
const MermaidOperationSchema = Schema.Literal("initialize", "render");

/** Expected client failure while loading, configuring, or rendering Mermaid. */
class MermaidRenderError extends Schema.TaggedError<MermaidRenderError>()(
  "MermaidRenderError",
  {
    cause: Schema.Unknown,
    operation: MermaidOperationSchema,
  }
) {}

/**
 * Loads Mermaid on the client and applies the site defaults before rendering.
 */
const initializeMermaid = Effect.fn("designSystem.mermaid.initialize")(
  function* (customConfig?: MermaidConfig) {
    const defaultConfig = {
      startOnLoad: false,
      theme: "default",
      securityLevel: "strict",
      fontFamily: "inherit",
      suppressErrorRendering: true,
    } satisfies MermaidConfig;

    const config = { ...defaultConfig, ...customConfig };
    const mermaidModule = yield* Effect.tryPromise({
      try: () => import("mermaid"),
      catch: (cause) =>
        new MermaidRenderError({ cause, operation: "initialize" }),
    });
    const mermaid = mermaidModule.default;

    yield* Effect.try({
      try: () => mermaid.initialize(config),
      catch: (cause) =>
        new MermaidRenderError({ cause, operation: "initialize" }),
    });

    return mermaid;
  }
);

/** Renders one Mermaid chart through the typed client boundary. */
const renderMermaid = Effect.fn("designSystem.mermaid.render")(function* (
  renderId: string,
  chart: string,
  config: MermaidConfig
) {
  const mermaid = yield* initializeMermaid(config);

  return yield* Effect.tryPromise({
    try: () => mermaid.render(renderId, chart),
    catch: (cause) => new MermaidRenderError({ cause, operation: "render" }),
  });
});

/** Creates a stable Mermaid DOM id for one component instance and chart body. */
function getMermaidRenderId(componentId: string, chart: string) {
  const chartHash = chart.split("").reduce((acc, char) => {
    // biome-ignore lint/suspicious/noBitwiseOperators: Mermaid render ids only need a compact deterministic hash.
    return ((acc << SHIFT_5) - acc + char.charCodeAt(0)) | HASH_SEED;
  }, HASH_SEED);

  return `mermaid-${componentId.replaceAll(":", "")}-${Math.abs(chartHash).toString(36)}`;
}

/** Converts unknown Mermaid renderer failures into a user-visible message. */
function getMermaidRenderErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to render Mermaid chart";
}

interface MermaidProps {
  chart: string;
  className?: string;
  config?: MermaidConfig;
  label: string;
}

/**
 * Renders Mermaid chart markup with a cached last-good SVG fallback.
 */
export const Mermaid = ({ chart, className, config, label }: MermaidProps) => {
  const componentId = useId();
  const { resolvedTheme } = useTheme();
  const renderId = getMermaidRenderId(componentId, chart);
  const theme =
    config?.theme ??
    (getThemeAppearance(resolvedTheme) === "dark" ? "dark" : "default");
  const renderKey = `${renderId}-${theme}`;
  const [renderState, setRenderState] = useState({
    errorMessage: "",
    renderKey: "",
    svg: "",
  });
  const lastValidSvg = useRef("");

  useEffect(() => {
    const renderFiber = Effect.runFork(
      renderMermaid(renderId, chart, { ...config, theme }).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            Effect.sync(() => {
              const svg = lastValidSvg.current;

              captureException(error.cause, {
                has_cached_svg: !!svg,
                operation: error.operation,
                source: "mermaid-render",
              });

              return {
                errorMessage: svg
                  ? ""
                  : getMermaidRenderErrorMessage(error.cause),
                renderKey,
                svg,
              };
            }),
          onSuccess: ({ svg }) =>
            Effect.sync(() => {
              lastValidSvg.current = svg;
              return {
                errorMessage: "",
                renderKey,
                svg,
              };
            }),
        }),
        Effect.tap((nextRenderState) =>
          Effect.sync(() => setRenderState(nextRenderState))
        )
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(renderFiber));
    };
  }, [chart, config, renderId, renderKey, theme]);

  const hasCurrentRender = renderState.renderKey === renderKey;

  // Show loading only on initial load when we have no content
  if (!(hasCurrentRender || renderState.svg)) {
    return (
      <div className={cn("my-4 aspect-video p-4", className)}>
        <div className="flex size-full items-center justify-center">
          <Spinner />
        </div>
      </div>
    );
  }

  // Only show error if we have no valid SVG to display
  if (hasCurrentRender && renderState.errorMessage && !renderState.svg) {
    return (
      <div
        className={cn(
          "border border-destructive bg-card p-4 text-destructive",
          className
        )}
      >
        <p className="font-mono text-sm">
          Mermaid Error: {renderState.errorMessage}
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs">Show Code</summary>
          <pre className="mt-2 overflow-x-auto rounded border bg-background p-2 text-foreground text-xs">
            {chart}
          </pre>
        </details>
      </div>
    );
  }

  // Always render the SVG if we have content (either current or last valid)
  return (
    <div
      aria-label={label}
      className={cn("my-4 flex justify-center", className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid returns sanitized SVG in strict security mode.
      dangerouslySetInnerHTML={{ __html: renderState.svg }}
      role="img"
    />
  );
};
