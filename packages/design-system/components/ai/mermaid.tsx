"use client";
import { captureException } from "@repo/analytics/posthog/browser";
import { CodeBlockText } from "@repo/design-system/components/code-block/text";
import { codeFencePreVariants } from "@repo/design-system/components/markdown/react/variants";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  type MermaidRenderConfig,
  renderMermaid,
} from "@repo/design-system/lib/mermaid/render";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { createStableId } from "@repo/utilities/id";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Effect, Fiber } from "effect";
import { useTheme } from "next-themes";
import { type RefObject, useEffect, useId, useRef, useState } from "react";

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

/**
 * Renders one attempt and returns the SVG to show. A failed attempt returns
 * the last good SVG, and only a failure other than rejected chart text is
 * reported.
 */
function renderAttempt(
  attemptId: string,
  chart: string,
  config: MermaidRenderConfig,
  lastValidSvg: RefObject<string>
) {
  return renderMermaid(attemptId, chart, config).pipe(
    Effect.map(({ svg }) => {
      lastValidSvg.current = svg;
      return svg;
    }),
    Effect.catchTags({
      MermaidSyntaxError: () => Effect.sync(() => lastValidSvg.current),
      MermaidRenderError: (error) =>
        Effect.sync(() => {
          captureException(error.cause, {
            has_cached_svg: !!lastValidSvg.current,
            operation: error.operation,
            source: "mermaid-render",
          });
          return lastValidSvg.current;
        }),
    })
  );
}

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
      renderAttempt(attemptId, chart, { ...config, theme }, lastValidSvg).pipe(
        Effect.tap((svg) =>
          Effect.sync(() => setRenderState({ renderKey, svg }))
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
  // With no SVG to show, the chart text stays readable instead of an error.
  if (!renderState.svg) {
    return (
      <div className={cn("flex flex-col gap-2 overflow-auto", className)}>
        <p className="text-muted-foreground text-sm">
          This diagram could not be drawn. Its source is below.
        </p>
        <CodeBlockText preClassName={codeFencePreVariants()}>
          {chart}
        </CodeBlockText>
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
