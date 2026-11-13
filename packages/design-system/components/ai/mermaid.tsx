import { Alert02Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { captureException } from "@repo/analytics/posthog/capture";
import { operationalErrorName } from "@repo/analytics/posthog/exception";
import { CodeBlockText } from "@repo/design-system/components/code/text";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { legibleSvg } from "@repo/design-system/lib/mermaid/legible";
import {
  type MermaidRenderConfig,
  renderMermaid,
} from "@repo/design-system/lib/mermaid/render";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import { createStableId } from "@repo/utilities/id";
import { cn } from "cn";
import { Effect, Fiber } from "effect";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "use-intl";

/**
 * A piece of text from a diagram that cannot be drawn, such as the parser's
 * own words or the code that failed. Its box is filled and has no border, so
 * the card around the diagram holds no box inside a box. Its text is
 * `foreground` on `muted`, a pair the theme contract checks in every theme.
 */
function FailureText({ children }: { children: string }) {
  return (
    <CodeBlockText preClassName="overflow-x-auto rounded bg-muted p-2 text-foreground text-xs">
      {children}
    </CodeBlockText>
  );
}

interface MermaidProps {
  chart: string;
  className?: string;
  config?: MermaidRenderConfig | undefined;
  label: string;
  /** The multiple of its natural size a reader zoomed the diagram to; without one it fits its box. */
  zoom?: number | undefined;
}
/**
 * Renders Mermaid chart markup with a cached last-good SVG fallback. The
 * caller sizes the box; the pending, error, and rendered states all fill it,
 * so the diagram never resizes its surroundings when it arrives. The diagram
 * fits the box at a legible scale, centered by auto margins; a diagram larger
 * than that starts at the box's edge, and the box is the one place it scrolls.
 */
export function Mermaid({
  chart,
  className,
  config,
  label,
  zoom,
}: MermaidProps) {
  const t = useTranslations("Ai");
  const tCommon = useTranslations("Common");
  const componentId = useId();
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const renderId = createStableId(
    `mermaid-${componentId.replaceAll(":", "")}`,
    chart
  );
  const theme =
    config?.theme ??
    (getThemeAppearance(resolvedTheme) === "dark" ? "dark" : "default");
  const renderKey = `${renderId}-${theme}`;
  const [renderState, setRenderState] = useState({
    detail: "",
    failed: false,
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
                error_name: operationalErrorName(error.cause),
                has_cached_svg: !!svg,
                operation: error.operation,
                source: "mermaid-render",
              });
              return {
                // The parser's own words are shown only when no earlier
                // render can stand in for this one.
                detail:
                  svg || !(error.cause instanceof Error)
                    ? ""
                    : error.cause.message,
                failed: !svg,
                renderKey,
                svg,
              };
            }),
          onSuccess: ({ svg }) =>
            Effect.sync(() => {
              lastValidSvg.current = svg;
              return {
                detail: "",
                failed: false,
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
        <Spinner className="m-auto" label={tCommon("loading")} />
      </div>
    );
  }
  // Only show error if we have no valid SVG to display
  if (hasCurrentRender && renderState.failed && !renderState.svg) {
    return (
      <div className={cn("flex overflow-auto", className)}>
        <Collapsible className="m-auto flex w-full min-w-0 flex-col gap-2 p-4">
          <p className="flex items-start gap-2 text-sm">
            <HugeIcons
              aria-hidden="true"
              className="text-destructive mt-0.5"
              icon={Alert02Icon}
            />
            {t("diagram-error")}
          </p>
          <CollapsibleTrigger className="group/failure text-muted-foreground hover:text-foreground focus-visible:ring-ring flex min-h-6 w-fit items-center gap-1 rounded-sm text-xs transition-colors outline-none focus-visible:ring-2">
            {t("show-code")}
            <HugeIcons
              aria-hidden="true"
              className="transition-transform group-data-panel-open/failure:rotate-180 motion-reduce:transition-none"
              icon={ArrowDown01Icon}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-2 motion-reduce:transition-none">
            {renderState.detail ? (
              <FailureText>{renderState.detail}</FailureText>
            ) : null}
            <FailureText>{chart}</FailureText>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }
  // Always render the SVG if we have content (either current or last valid)
  return (
    <div
      aria-label={label}
      className={cn(
        "flex overflow-auto [&>svg]:m-auto [&>svg]:shrink-0",
        className
      )}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid returns sanitized SVG in strict security mode.
      dangerouslySetInnerHTML={{ __html: legibleSvg(renderState.svg, zoom) }}
      role="img"
    />
  );
}
