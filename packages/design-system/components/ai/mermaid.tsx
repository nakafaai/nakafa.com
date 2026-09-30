"use client";
import { captureException } from "@repo/analytics/posthog/browser";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  type MermaidRenderConfig,
  renderMermaid,
} from "@repo/design-system/lib/mermaid/render";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { createStableId } from "@repo/utilities/helper";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Effect, Fiber } from "effect";
import { useTheme } from "next-themes";
import { useEffect, useId, useRef, useState } from "react";

/** Converts unknown Mermaid renderer failures into a user-visible message. */
function getMermaidRenderErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to render Mermaid chart";
}
/**
 * How a rendered diagram sits in its box. Auto margins center a smaller
 * diagram and let a larger one start at the edge, where it stays scrollable.
 */
const diagramVariants = cva("flex [&>svg]:m-auto", {
  variants: {
    fit: {
      /** Scales the diagram to fit the box; Mermaid's own max width keeps it from growing past its natural size. */
      contain: "[&>svg]:size-full",
      /** Fits the diagram to the box width and scrolls the rest of its height. */
      width: "overflow-auto [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-full",
    },
  },
});

type MermaidProps = VariantProps<typeof diagramVariants> & {
  chart: string;
  className?: string;
  config?: MermaidRenderConfig | undefined;
  label: string;
};
/**
 * Renders Mermaid chart markup with a cached last-good SVG fallback. The
 * caller sizes the box; the pending, error, and rendered states all fill it,
 * so the diagram never resizes its surroundings when it arrives.
 */
export function Mermaid({
  chart,
  className,
  config,
  fit = "contain",
  label,
}: MermaidProps) {
  const componentId = useId();
  const { resolvedTheme } = useTheme();
  const renderId = createStableId(
    `mermaid-${componentId.replaceAll(":", "")}`,
    chart
  );
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
  const renderSequence = useRef(0);
  useEffect(() => {
    // Mermaid removes existing elements with its render ID before drawing.
    // Each attempt needs a fresh ID so it cannot remove the cached live SVG.
    renderSequence.current += 1;
    const attemptId = `${renderId}-${renderSequence.current}`;
    const renderFiber = Effect.runFork(
      renderMermaid(attemptId, chart, { ...config, theme }).pipe(
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
      <div className={cn("flex", className)}>
        <Spinner className="m-auto" />
      </div>
    );
  }
  // Only show error if we have no valid SVG to display
  if (hasCurrentRender && renderState.errorMessage && !renderState.svg) {
    return (
      <div className={cn("flex overflow-auto", className)}>
        <div className="m-auto w-full border border-destructive bg-card p-4 text-destructive">
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
      </div>
    );
  }
  // Always render the SVG if we have content (either current or last valid)
  return (
    <div
      aria-label={label}
      className={cn(diagramVariants({ fit }), className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid returns sanitized SVG in strict security mode.
      dangerouslySetInnerHTML={{ __html: renderState.svg }}
      role="img"
    />
  );
}
