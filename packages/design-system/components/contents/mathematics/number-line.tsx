"use client";

import {
  formatInterval,
  type Interval,
  intervalSeparator,
} from "@repo/design-system/components/contents/mathematics/interval";
import { MATH_NUMBER_OPTIONS } from "@repo/design-system/components/contents/mathematics/number";
import {
  positionOf,
  type SegmentBounds,
  segmentBounds,
  segmentEdge,
} from "@repo/design-system/components/contents/mathematics/segment";
import { solutionSetMath } from "@repo/design-system/components/contents/mathematics/solution";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

const numberLineSegmentVariants = cva("absolute top-1/2 h-8 -translate-y-1/2", {
  variants: {
    edge: {
      bothInfinity: "",
      endInfinity: "rounded-l-sm",
      finite: "rounded-sm",
      startInfinity: "rounded-r-sm",
    },
  },
  defaultVariants: {
    edge: "finite",
  },
});

/** One authored segment of a number line. */
export interface NumberLineSegment {
  /** The background color of the segment */
  backgroundColor?: string;
  /** The end value of the segment. A missing end draws a ray to the right edge of the axis. */
  end?: number;
  /** Whether the end value is inclusive */
  endInclusive?: boolean;
  /** Custom label for the end point (e.g., fraction in LaTeX) */
  endLabel?: ReactNode;
  /** The label of the segment */
  label?: ReactNode;
  /** Whether the segment is shaded */
  shaded?: boolean;
  /** Whether the segment should show points */
  showPoints?: boolean;
  /** The start value of the segment. A missing start draws a ray to the left edge of the axis. */
  start?: number;
  /** Whether the start value is inclusive */
  startInclusive?: boolean;
  /** Custom label for the start point (e.g., fraction in LaTeX) */
  startLabel?: ReactNode;
}

interface NumberLineCardProps {
  /** The card's header. A graph that builds its own title and description passes it here. */
  header: ReactNode;
  max?: number;
  min?: number;
  segments: NumberLineSegment[];
}

interface NumberLineProps extends Omit<NumberLineCardProps, "header"> {
  description: ReactNode;
  title: ReactNode;
}

/** The range and segments of one number line, which its body and its facts both draw from. */
interface NumberLineConfig {
  max?: number | undefined;
  min?: number | undefined;
  segments: readonly NumberLineSegment[];
}

/** Returns the finite bounds that should contribute to the number-line range. */
function getFiniteSegmentValues({ end, start }: SegmentBounds) {
  const hasFiniteStart = Number.isFinite(start);
  const hasFiniteEnd = Number.isFinite(end);

  if (hasFiniteStart && hasFiniteEnd) {
    return [start, end];
  }

  if (hasFiniteStart) {
    return [start];
  }

  if (hasFiniteEnd) {
    return [end];
  }

  return [];
}

/** The interval the scale draws: the range of its segments, with a margin of fifteen percent on each side. */
function drawnScale({ max, min, segments }: NumberLineConfig): Interval {
  const allValues = Arr.flatMap(segments, (segment) =>
    getFiniteSegmentValues(segmentBounds(segment))
  );

  const rangeMin = min ?? (allValues.length > 0 ? Math.min(...allValues) : -10);
  const rangeMax = max ?? (allValues.length > 0 ? Math.max(...allValues) : 10);
  const padding = (rangeMax - rangeMin) * 0.15;
  return { max: rangeMax + padding, min: rangeMin - padding };
}

/** Draws one number line's scale, its segments, their labels, and its full screen action. */
function NumberLineBody({ config }: { config: NumberLineConfig }) {
  const { segments } = config;
  const scale = drawnScale(config);

  const processedSegments = Arr.map(segments, (segment, index) => {
    const bounds = segmentBounds(segment);
    const startPos = positionOf(bounds.start, scale);
    const endPos = positionOf(bounds.end, scale);
    const width = endPos - startPos;

    const shaded = segment.shaded ?? true;
    const bgColor = segment.backgroundColor;
    const edge = segmentEdge(bounds);

    const showPoints = segment.showPoints ?? edge === "finite";

    return {
      ...segment,
      ...bounds,
      startPos,
      endPos,
      width,
      shaded,
      bgColor,
      showPoints,
      edge,
      index,
    };
  });

  return (
    <>
      <VisualCardBody>
        <div className="w-full p-(--card-spacing)">
          <div className="relative h-20 w-full">
            {Arr.map(processedSegments, (segment) => (
              <div key={`bg-${segment.start}-${segment.end}-${segment.index}`}>
                {!!segment.shaded && (
                  <div
                    className={cn(
                      numberLineSegmentVariants({ edge: segment.edge }),
                      !segment.bgColor && "bg-chart-1"
                    )}
                    style={{
                      left: `${segment.startPos}%`,
                      width: `${segment.width}%`,
                      ...(!!segment.bgColor && {
                        backgroundColor: segment.bgColor,
                      }),
                    }}
                  />
                )}
              </div>
            ))}

            <div className="absolute top-1/2 h-px w-full bg-foreground" />

            {Arr.map(processedSegments, (segment) => (
              <div
                key={`label-${segment.start}-${segment.end}-${segment.index}`}
              >
                {!!segment.label && (
                  <div
                    className="absolute top-0 -translate-x-1/2 whitespace-nowrap font-medium text-sm"
                    style={{ left: `${segment.startPos + segment.width / 2}%` }}
                  >
                    {segment.label}
                  </div>
                )}
              </div>
            ))}

            {Arr.map(processedSegments, (segment) => (
              <div
                key={`points-${segment.start}-${segment.end}-${segment.index}`}
              >
                {Number.isFinite(segment.start) &&
                  (segment.showPoints || segment.startLabel) && (
                    <div
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${segment.startPos}%` }}
                    >
                      {!!segment.showPoints && (
                        <div
                          className={cn(
                            "size-4 rounded-full border border-foreground",
                            segment.startInclusive
                              ? "bg-foreground"
                              : "bg-background"
                          )}
                        />
                      )}
                      <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm">
                        {segment.startLabel ?? (
                          <InlineMath math={segment.start.toString()} />
                        )}
                      </div>
                    </div>
                  )}

                {Number.isFinite(segment.end) &&
                  (segment.showPoints || segment.endLabel) && (
                    <div
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${segment.endPos}%` }}
                    >
                      {!!segment.showPoints && (
                        <div
                          className={cn(
                            "size-4 rounded-full border border-foreground",
                            segment.endInclusive
                              ? "bg-foreground"
                              : "bg-background"
                          )}
                        />
                      )}
                      <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm">
                        {segment.endLabel ?? (
                          <InlineMath math={segment.end.toString()} />
                        )}
                      </div>
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>
      </VisualCardBody>
      <VisualCardActions>
        <VisualCardFullscreen />
      </VisualCardActions>
    </>
  );
}

/** The scale and the solution set of a number line, as the readouts of its footer. */
function NumberLineFacts({ config }: { config: NumberLineConfig }) {
  const t = useTranslations("Common");
  const format = useFormatter();
  const locale = useLocale();
  const formatNumber = (value: number) =>
    format.number(value, MATH_NUMBER_OPTIONS);
  const separator = intervalSeparator(locale);

  return (
    <VisualCardFacts>
      <VisualFact
        label={t("scale")}
        value={
          <InlineMath
            math={formatInterval(drawnScale(config), formatNumber, separator)}
          />
        }
      />
      <VisualFact
        label={t("solution-set")}
        value={
          <InlineMath
            math={solutionSetMath(config.segments, formatNumber, separator)}
          />
        }
      />
    </VisualCardFacts>
  );
}

/**
 * Draws one number line card under the header its caller builds: its scale, and the readouts
 * of its footer. It holds no client state, so a server card draws it and its math stays on the
 * server.
 */
function NumberLineFrame({
  config,
  header,
}: {
  config: NumberLineConfig;
  header: ReactNode;
}) {
  return (
    <VisualCard>
      {header}
      <NumberLineBody config={config} />
      <VisualCardFooter>
        <NumberLineFacts config={config} />
      </VisualCardFooter>
    </VisualCard>
  );
}

/** Draws one authored number line card, with the title and description of its lesson. */
export function NumberLine({
  description,
  max,
  min,
  segments,
  title,
}: NumberLineProps) {
  return (
    <NumberLineFrame
      config={{ max, min, segments }}
      header={<VisualCardHeader description={description} title={title} />}
    />
  );
}

/** Draws one number line card under a header its caller builds. */
export function NumberLineCard({
  header,
  max,
  min,
  segments,
}: NumberLineCardProps) {
  return <NumberLineFrame config={{ max, min, segments }} header={header} />;
}
